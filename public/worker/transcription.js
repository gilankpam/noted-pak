import {
  AutoTokenizer,
  AutoProcessor,
  WhisperForConditionalGeneration,
  TextStreamer,
  env
} from "@huggingface/transformers";

const MAX_NEW_TOKENS = 512;
env.allowLocalModels = false;

const whisperModelOptions = {
  whisper_base_f32: {
    label: 'Whisper Base f32 (Heavier)',
    model_id: 'onnx-community/whisper-base',
    params: {
      dtype: {
        encoder_model: "fp32",
        decoder_model_merged: "fp32",
      },
    }
  },
  whisper_base_q4: {
    label: 'Whisper Base q4 (Lighter)',
    model_id: 'onnx-community/whisper-base',
    params: {
      dtype: {
        encoder_model: "q4",
        decoder_model_merged: "q4",
      },
    }
  }
}

class AutomaticSpeechRecognitionPipeline {
  static model_id = null;
  static tokenizer = null;
  static processor = null;
  static model = null;
  static currentModel = null;
  static defaultModel = whisperModelOptions.whisper_base_q4;

  static getInstance() {
    if (!this.tokenizer || !this.processor || !this.model) {
      throw new Error('Model is not loaded')
    }

    return [this.tokenizer, this.processor, this.model];
  }

  static async loadModel(progress_callback, modelName) {
    if (this.model && this.tokenizer && this.processor && modelName === this.currentModel) {
      return [this.tokenizer, this.processor, this.model];
    }
    let selectedModelConfig = this.defaultModel
    if (modelName) {
      selectedModelConfig = whisperModelOptions[modelName]
    }
    this.currentModel = selectedModelConfig.name;

    const model_id = selectedModelConfig.model_id;
    console.log(`Loading resources for ${model_id} with params:`, selectedModelConfig.params);

    // Ensure components are loaded sequentially or awaited properly
    this.tokenizer = await AutoTokenizer.from_pretrained(model_id, {
      progress_callback,
    });
    this.processor = await AutoProcessor.from_pretrained(model_id, {
      progress_callback,
    });
    this.model = await WhisperForConditionalGeneration.from_pretrained(
      model_id,
      {
        ...selectedModelConfig.params,
        device: "webgpu",
        progress_callback,
      }
    );
    console.log("Model loaded successfully:", model_id);
    this.currentModel = modelName;
    return [this.tokenizer, this.processor, this.model];
  }

  static async unloadModel() {
    this.tokenizer = null;
    this.processor = null;
    await this.model.dispose();
    this.model = null;
  }
}

let processing = false;

async function generate({ audio, language = 'en'}) {
  if (processing) {
    self.postMessage({ status: "busy", error: "Processor is busy." });
    return;
  }
  processing = true;

  self.postMessage({ status: "start" });

  try {
    const [tokenizer, processor, model] =
      AutomaticSpeechRecognitionPipeline.getInstance();

    const callback_function = (output) => {
      self.postMessage({
        status: "update",
        output
      });
    };

    const streamer = new TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function,
    });

    const inputs = await processor(audio, { sampling_rate: 16000 });

    await model.generate({
      ...inputs,
      max_new_tokens: MAX_NEW_TOKENS,
      language: language || "en",
      streamer
    });

    self.postMessage({
      status: "complete"
    });

  } catch (error) {
    self.postMessage({ status: "error", error: error.message, stack: error.stack });
  } finally {
    processing = false;
  }
}

async function load({ modelName } = null) {
  self.postMessage({
    status: "loading"
  });

  try {
    const [, processor, model] = 
      await AutomaticSpeechRecognitionPipeline.loadModel(x => self.postMessage(x), modelName)

    self.postMessage({
      status: "loading",
      data: "Compiling shaders and warming up model...",
    });
    
    const dummyAudio = new Float32Array(16000 * 1); // 1 second of silence for warmup
    const dummyProcessed = await processor(dummyAudio, { sampling_rate: 16000 });

    await model.generate({
      input_features: dummyProcessed.input_features, // Use processed dummy audio
      max_new_tokens: 1, // Generate only one token for warmup
    });
    self.postMessage({ status: "ready" });
  } catch (error) {
    self.postMessage({ status: "error", error: `Model load/warmup failed: ${error.message}`, stack: error.stack });
  }
}

async function unload() {
  await AutomaticSpeechRecognitionPipeline.unloadModel();
}

self.addEventListener("message", async (e) => {
  const { type, data } = e.data; // Changed modelName to modelSlug

  switch (type) {
    case "load":
      await load({...data});
      break;
    case "unload":
      await unload();
      break;
    case "generate":
      await generate({ ...data });
      break;
    default:
      console.warn(`Worker received unknown message type: ${type}`);
      break;
  }
});
