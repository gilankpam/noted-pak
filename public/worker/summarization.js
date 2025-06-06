/* eslint-disable no-restricted-globals */
import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
  env
} from "@huggingface/transformers";

env.allowLocalModels = false;
const llmOptions = {
    'qwen3-0.6b': { model_id: "onnx-community/Qwen3-0.6B-ONNX" },
    'smollm2-1.7b': { model_id: "HuggingFaceTB/SmolLM2-1.7B-Instruct"}
};
const stopping_criteria = new InterruptableStoppingCriteria();
let past_key_values_cache = null;

async function checkWebGPU() {
  try {
    if (!navigator.gpu) {
      throw new Error("WebGPU is not supported by this browser. Use openai model in the setting");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("WebGPU is not supported (no adapter found)");
    }
    self.postMessage({
      status: "webgpu_check_success",
      data: "WebGPU is available.",
    });
  } catch (e) {
    self.postMessage({
      status: "error",
      type: "webgpu_check_error",
      data: e.toString(),
    });
  }
}

const systemPrompt = "You are a helpful meeting summarization assistant. Provide a concise summary based on the provided transcript.";

function getUserMessage(meetingTitle, transcriptionText) {
  let userMsg = `Summarize the following meeting transcript concisely, focusing on key decisions, action items, and important discussions. Current time is ${new Date()}`;
  if (meetingTitle && meetingTitle.trim() !== "") {
    userMsg += `The title of this meeting is "${meetingTitle}".`;
  }
  userMsg += `
Structure the summary with the following sections:
1. Meeting Overview: Date, attendees, and primary objective.
2. Key Discussion Points: Bullet points of major topics covered (limit to 3-5).
3. Decisions Made: Clear outcomes or resolutions agreed upon.
4. Action Items: Specific tasks, assigned owners, and deadlines (if mentioned).
5. Next Steps: Any follow-up meetings or pending discussions.

Maintain a professional tone, avoid unnecessary details, and ensure clarity.

Here is the transcript:
"${transcriptionText}"`;

  return userMsg;
}

/**
 * This class uses the Singleton pattern to enable lazy-loading of the pipeline
 */
class SummarizationPipeline {
  static tokenizer = null;
  static model = null;
  static currentModelId = '';

  static async getInstance(progress_callback = null, model_id) {
    // Check for WebGPU availability before attempting to load the local model
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          const errorMsg = "WebGPU is not supported (no adapter found). Local model disabled.";
          self.postMessage({ status: "error", type: "webgpu_unavailable", data: errorMsg });
          throw new Error(errorMsg);
        }
      } catch (e) {
        const errorMsg = `Error requesting WebGPU adapter: ${e.message}. Local model disabled.`;
        self.postMessage({ status: "error", type: "webgpu_unavailable", data: errorMsg });
        throw new Error(errorMsg);
      }
    } else {
      const errorMsg = "WebGPU is not supported by this browser. Local model disabled.";
      self.postMessage({ status: "error", type: "webgpu_unavailable", data: errorMsg });
      throw new Error(errorMsg);
    }

    // Proceed with loading tokenizer and model if WebGPU check passed
    if (!this.tokenizer || this.currentModelId !== model_id) {
      this.tokenizer = await AutoTokenizer.from_pretrained(model_id, {
        progress_callback,
      });
    }

    if (this.model && this.currentModelId !== model_id) {
      await this.model.dispose();
      this.model = null;
    }

    if (!this.model) {
      this.model = await AutoModelForCausalLM.from_pretrained(model_id, {
        dtype: "q4f16", // Using quantization for better performance
        device: "webgpu", // This will now only be attempted if WebGPU is available
        progress_callback,
      });

      await this.model.generate({ ...this.tokenizer("x"), max_new_tokens: 1 }); // Compile shaders
      past_key_values_cache = null;
    }

    this.currentModelId = model_id;

    // Wait for both promises to resolve
    return [this.tokenizer, this.model];
  }
}

// Function to generate summary using OpenAI API
async function generateSummaryOpenAI({ transcriptionText, meetingTitle, settings }) {
  self.postMessage({ status: "summarizing_started" }); // OpenAI doesn't have a "thinking" phase in the same way

  const { apiToken, baseUrl, modelName } = settings.llm.openai;

  if (!apiToken) {
    self.postMessage({
      status: "error",
      type: "summarization_error",
      data: "OpenAI API token is not configured.",
    });
    return;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: getUserMessage(meetingTitle, transcriptionText) }
  ];

  // Inform the UI
  self.postMessage({
    status: "update",
    output: "",
    state: 'thinking'
  });

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: messages,
        stream: true, // Request streaming
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`OpenAI API Error: ${response.status} ${errorData.message || errorData.error?.message || ''}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedChunks = "";
    let fullSummary = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      accumulatedChunks += decoder.decode(value, { stream: true });
      
      // Process server-sent events (SSE)
      let boundary = accumulatedChunks.indexOf('\n\n');
      while (boundary !== -1) {
        const chunk = accumulatedChunks.substring(0, boundary);
        accumulatedChunks = accumulatedChunks.substring(boundary + 2);
        
        if (chunk.startsWith('data: ')) {
          const jsonData = chunk.substring(6);
          if (jsonData.trim() === '[DONE]') {
            break;
          }
          try {
            const parsed = JSON.parse(jsonData);
            if (parsed.choices && parsed.choices[0].delta && parsed.choices[0].delta.content) {
              const content = parsed.choices[0].delta.content;
              fullSummary += content;
              self.postMessage({
                status: "update",
                output: content, // Send delta content for streaming update
                state: "answering", // OpenAI is always in "answering" state from user's perspective
              });
            }
          } catch (e) {
            console.warn("Summarization worker: Could not parse OpenAI stream chunk:", jsonData, e);
          }
        }
        boundary = accumulatedChunks.indexOf('\n\n');
      }
      if (accumulatedChunks.includes('[DONE]')) break; // Ensure loop termination if [DONE] is the last part
    }
    
    self.postMessage({
      status: "summarizing_complete",
      output: fullSummary,
    });

  } catch (e) {
    console.error("OpenAI Summarization Error:", e);
    self.postMessage({
      status: "error",
      type: "summarization_error",
      data: e.toString(),
    });
  }
}

async function generateSummaryLocalQwen({ transcriptionText, meetingTitle }) {
  try {
    const model_id = llmOptions['qwen3-0.6b'].model_id;

    const [tokenizer, model] = await SummarizationPipeline.getInstance((progress) => {
      self.postMessage(progress); // Forward progress events
    }, model_id);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: getUserMessage(meetingTitle, transcriptionText) }
    ];

    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
    });

    // Always encode <think> tokens
    const [START_THINKING_TOKEN_ID, END_THINKING_TOKEN_ID] = tokenizer.encode(
      "<think></think>",
      { add_special_tokens: false },
    );

    let state = "thinking"; // 'thinking' or 'answering'

    const token_callback_function = (tokens) => {
      // Always check for think tokens
      switch (Number(tokens[0])) {
        case START_THINKING_TOKEN_ID:
          state = "thinking";
          break;
        case END_THINKING_TOKEN_ID:
          state = "answering";
          break;
      }
    };

    const callback_function = (output) => {
      let dataToSend = {
        status: "update",
        output: "",
        state
      };

      const regex = /<\/think>/;
      // Always apply thinking mode logic for streaming
      if (state === "answering" && !regex.test(output)) {
        dataToSend.output = output; // Send raw output during answering state
      }
      // If state is "thinking", output remains empty. App.js shows status based on state.
      self.postMessage(dataToSend);
    };

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function,
      token_callback_function,
    });

    const generationConfig = {
      ...inputs,
      past_key_values: past_key_values_cache,
      do_sample: false,
      top_k: 20, // Always use thinking mode parameters
      temperature: 0.7, // Always use thinking mode parameters
      max_new_tokens: 16384, // Always use thinking mode parameters
      streamer,
      stopping_criteria,
      return_dict_in_generate: true,
    };
    
    self.postMessage({ status: "summarizing_started" });
    self.postMessage({
      status: "update",
      output: "",
      state: 'thinking'
    });

    const { past_key_values, sequences } = await model.generate(generationConfig);
    past_key_values_cache = past_key_values;

    self.postMessage({
      status: "summarizing_complete"
    });

  } catch (e) {
    self.postMessage({
      status: "error",
      type: "summarization_error",
      data: e.toString(),
    });
  }
}

async function generateSummaryLocalSmollm2({ transcriptionText, meetingTitle }) {
  try {
    const model_id = llmOptions['smollm2-1.7b'].model_id;
    const [tokenizer, model] = await SummarizationPipeline.getInstance((progress) => {
      self.postMessage(progress); // Forward progress events
    }, model_id);

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: getUserMessage(meetingTitle, transcriptionText) }
    ];

    const inputs = tokenizer.apply_chat_template(messages, {
      add_generation_prompt: true,
      return_dict: true,
    });

    // Inform the UI
    self.postMessage({
      status: "update",
      output: "",
      state: 'thinking'
    });

    const callback_function = (output) => {
      self.postMessage({
        status: "update",
        output,
        state: 'answering'
      });
    };

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function,
      token_callback_function: () => {},
    });

    const generationConfig = {
      ...inputs,
      past_key_values: past_key_values_cache,
      do_sample: false,
      max_new_tokens: 4092,
      streamer,
      stopping_criteria,
      return_dict_in_generate: true,
    };

    self.postMessage({ status: "summarizing_started" });
    
    const { past_key_values, sequences } = await model.generate(generationConfig);
    past_key_values_cache = past_key_values;

    self.postMessage({
      status: "summarizing_complete"
    });
  } catch (e) {
    self.postMessage({
      status: "error",
      type: "summarization_error",
      data: e.toString(),
    });
  }
}

async function generateSummary({ transcriptionText, meetingTitle, settings }) { // Added settings
  if (settings && settings.llm && settings.llm.type === 'openai') {
    await generateSummaryOpenAI({ transcriptionText, meetingTitle, settings });
    return;
  }

  if (settings && settings.llm && settings.llm.type === 'local') {
    switch (settings.llm.localModel) {
      case 'qwen3-0.6b':
        await generateSummaryLocalQwen({ transcriptionText, meetingTitle });
        break;
      case 'smollm2-1.7b':
      default:
        await generateSummaryLocalSmollm2({ transcriptionText, meetingTitle });
        break;
    }
  } else {
    await generateSummaryLocalSmollm2({ transcriptionText, meetingTitle });
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "check_webgpu":
      checkWebGPU();
      break;

    case "summarize":
      stopping_criteria.reset();
      generateSummary(data); 
      break;

    case "interrupt_summarization":
      stopping_criteria.interrupt();
      past_key_values_cache = null;
      self.postMessage({ status: "summarization_interrupted" });
      break;

    case "reset_summarization":
      past_key_values_cache = null;
      stopping_criteria.reset();
      self.postMessage({ status: "summarization_reset" });
      break;
    default:
      console.warn("Unknown message type received in summarization worker:", type);
      break;
  }
});
