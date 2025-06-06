/* eslint-disable no-restricted-globals */
import {
  AutoTokenizer,
  AutoModelForCausalLM,
  TextStreamer,
  InterruptableStoppingCriteria,
  env
} from "@huggingface/transformers";

env.allowLocalModels = false;

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
  static model_id = "onnx-community/Qwen3-0.6B-ONNX"; // Using the example model
  static tokenizer = null;
  static model = null;

  static async getInstance(progress_callback = null) {
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
    if (!this.tokenizer) {
      this.tokenizer = AutoTokenizer.from_pretrained(this.model_id, {
        progress_callback,
      });
    }

    if (!this.model) {
      this.model = AutoModelForCausalLM.from_pretrained(this.model_id, {
        dtype: "q4f16", // Using quantization for better performance
        device: "webgpu", // This will now only be attempted if WebGPU is available
        progress_callback,
      });
    }

    // Wait for both promises to resolve
    [this.tokenizer, this.model] = await Promise.all([this.tokenizer, this.model]);
    return [this.tokenizer, this.model];
  }
}

const stopping_criteria = new InterruptableStoppingCriteria();
let past_key_values_cache = null;

// Function to generate summary using OpenAI API
async function generateSummaryOpenAI({ transcriptionText, meetingTitle, settings }) {
  self.postMessage({ status: "summarizing_started", data: { reasonEnabled: false } }); // OpenAI doesn't have a "thinking" phase in the same way

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
                tps: null, // TPS not applicable/calculated for OpenAI in this setup
                numTokens: null, // Token count not easily available per chunk
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


// reasonEnabled parameter is removed, thinking mode is now default for local model
async function generateSummary({ transcriptionText, meetingTitle, settings }) { // Added settings
  if (settings && settings.llm && settings.llm.type === 'openai') {
    await generateSummaryOpenAI({ transcriptionText, meetingTitle, settings });
    return;
  } else {
    await generateSummaryLocal({ transcriptionText, meetingTitle, settings })
  }
}

async function generateSummaryLocal({ transcriptionText, meetingTitle }) {
  // Fallback to local model if settings are not for OpenAI
  self.postMessage({ status: "summarizing_started", data: { reasonEnabled: true } }); // Always indicate reasonEnabled is true for local

  try {
    const [tokenizer, model] = await SummarizationPipeline.getInstance((progress) => {
      self.postMessage(progress); // Forward progress events
    });

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
      temperature: 0.6, // Always use thinking mode parameters
      max_new_tokens: 4092, // Always use thinking mode parameters
      streamer,
      stopping_criteria,
      return_dict_in_generate: true,
    };
    
    // For some models, token_type_ids might not be needed or might cause issues if not handled correctly.
    // If the model is not a BERT-style model, it's often safer to omit token_type_ids.
    if (inputs.token_type_ids === undefined) {
        delete generationConfig.token_type_ids;
    }


    const { past_key_values, sequences } = await model.generate(generationConfig);
    past_key_values_cache = past_key_values;

    const decodedSequences = tokenizer.batch_decode(sequences, {
      skip_special_tokens: true, // This primarily removes tokenizer-defined special tokens like <s>, </s>
    });
    
    let fullGeneratedText = decodedSequences[0]; // This text includes the prompt if not skipped by batch_decode
    let cleanedFinalOutput;

    // Always apply thinking mode cleaning logic
    // `inputs.input_ids` contains the tokenized version of the full chat prompt + assistant generation hint
    // Decode these input_ids to get the exact prompt text that was fed to the model.
    const promptTextFromInputIds = tokenizer.decode(inputs.input_ids, { skip_special_tokens: true });

    if (fullGeneratedText.startsWith(promptTextFromInputIds)) {
        cleanedFinalOutput = fullGeneratedText.substring(promptTextFromInputIds.length);
    } else {
        // Fallback
        cleanedFinalOutput = fullGeneratedText;
        console.warn("Summarization worker: Prompt (from input_ids) not found at the start of batch_decode output. The final summary might contain parts of the prompt.");
    }
    
    // Remove <think>...</think> blocks from the assistant's actual response part.
    cleanedFinalOutput = cleanedFinalOutput.replace(/<think>.*?<\/think>/gs, "").trim();

    self.postMessage({
      status: "summarizing_complete",
      output: cleanedFinalOutput,
    });

  } catch (e) {
    self.postMessage({
      status: "error",
      type: "summarization_error",
      data: e.toString(),
    });
  }
}

async function loadModel() {
  self.postMessage({
    status: "loading",
    data: "Loading summarization model...",
  });

  try {
    const [tokenizer, model] = await SummarizationPipeline.getInstance((x) => {
      self.postMessage(x);
    });

    self.postMessage({
      status: "loading",
      data: "Compiling shaders and warming up summarization model...",
    });

    // Run model with dummy input to compile shaders
    const dummyPrompt = "This is a test.";
    const inputs = tokenizer(dummyPrompt);
    await model.generate({ ...inputs, max_new_tokens: 1 });
    self.postMessage({ status: "summarization_ready" });
  } catch (e) {
    self.postMessage({
      status: "error",
      type: "load_model_error",
      data: e.toString(),
    });
  }
}

// Listen for messages from the main thread
self.addEventListener("message", async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case "check_webgpu":
      checkWebGPU();
      break;

    case "load_model":
      loadModel();
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
