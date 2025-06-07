import {
  AutoTokenizer,
  AutoProcessor,
  AutoModel,
  WhisperForConditionalGeneration,
  TextStreamer,
  cos_sim,
  env
} from "@huggingface/transformers";

const MAX_NEW_TOKENS = 512;
env.allowLocalModels = false;

const whisperModelOptions = {
  whisper_base_f32: {
    model_id: 'onnx-community/whisper-base',
    params: {
      dtype: {
        encoder_model: "fp32",
        decoder_model_merged: "fp32",
      },
    }
  },
  whisper_base_q4: {
    model_id: 'onnx-community/whisper-base',
    params: {
      dtype: {
        encoder_model: "q4",
        decoder_model_merged: "q4",
      },
    }
  },
  whisper_small_q4: {
    model_id: 'onnx-community/whisper-small',
    params: {
      dtype: {
        encoder_model: "q4",
        decoder_model_merged: "q4",
      },
    }
  },
  whisper_distil_small: {
    model_id: 'distil-whisper/distil-small.en',
    params: {}
  },
  whisper_distil_medium: {
    model_id: 'distil-whisper/distil-medium.en',
    params: {}
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
    if (this.model) {
      await this.model.dispose();
    }
    this.model = null;
  }
}

class SpeakerVerificationPipeline {
  static model_id = "Xenova/wavlm-base-plus-sv";
  static model = null;
  static processor = null;

  static async getInstance(progress_callback = () => {}) {
    if (!this.processor) {
      this.processor = await AutoProcessor.from_pretrained(this.model_id, {
            device: 'wasm',
            dtype: 'fp32',
            progress_callback
        });
    }
    if (!this.model) {
      this.model = await AutoModel.from_pretrained(this.model_id, {
            device: 'wasm',
            dtype: 'fp32',
            progress_callback
        });
    }

    return [this.processor, this.model];
  }

  static async unloadModel() {
    this.processor = null;
    if (this.model) {
      await this.model.dispose();
    }
    this.model = null;
  }
}

let processing = false;
let audioQueue = []; // Initialize the audio queue
let useDiarization = false;
let speakerEmbeddings = [];
const SIMILARITY_THRESHOLD = 0.7; // Threshold for considering embeddings as same speaker

function getSpeakerId(newEmbeddings) {
  if (speakerEmbeddings.length === 0) {
    speakerEmbeddings.push(newEmbeddings);
    return 0; // First speaker
  }

  let bestMatchSpeakerId = -1;
  let highestSimilarity = -1;

  for (let i = 0; i < speakerEmbeddings.length; i++) {
    const existingEmbedding = speakerEmbeddings[i];
    const similarity = cos_sim(existingEmbedding, newEmbeddings);

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      if (similarity >= SIMILARITY_THRESHOLD) {
        bestMatchSpeakerId = i;
      }
    }
  }

  if (bestMatchSpeakerId !== -1) {
    // Found a sufficiently similar speaker
    return bestMatchSpeakerId;
  } else {
    // No existing speaker is similar enough, add as a new speaker
    speakerEmbeddings.push(newEmbeddings);
    return speakerEmbeddings.length - 1; // New speaker ID
  }
}

async function generate({ audio, language = 'en'}) {
  audioQueue.push({ audio, language });
  if (!processing) {
    processAudioQueue();
  }
}

async function processAudioQueue() {
  if (audioQueue.length === 0) {
    return;
  }
  if (processing) {
    return;
  }

  processing = true;
  const { audio, language } = audioQueue.shift();

  self.postMessage({ status: "start" });

  try {
    let speaker_id = null;

    if (useDiarization) {
      // Get speaker verification first
      const [verificationProcessor, verificationModel] = await SpeakerVerificationPipeline.getInstance();
      // Use a slice of the audio for speaker ID, ensuring it's not longer than the audio itself
      const audioSliceForSpeakerId = audio.length >= 2 * 16000 ? audio.slice(16000, 2 * 16000) : audio;
      const verificationInputs = await verificationProcessor(audioSliceForSpeakerId);
      const { embeddings } = await verificationModel(verificationInputs);
      speaker_id = getSpeakerId(embeddings.data);
    }

    const [tokenizer, processor, model] =
      AutomaticSpeechRecognitionPipeline.getInstance();

    const callback_function = (output) => {
      self.postMessage({
        status: "update",
        output,
        speaker_id 
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
      language: AutomaticSpeechRecognitionPipeline.currentModel.includes('distil') ? undefined : language || "en",
      streamer
    });

    self.postMessage({
      status: "complete",
      speaker_id
    });

  } catch (error) {
    self.postMessage({ status: "error", error: error.message, stack: error.stack });
  } finally {
    processing = false;
    // If there are more items in the queue, process the next one
    if (audioQueue.length > 0) {
      processAudioQueue();
    }
  }
}

async function load({ modelName, enableDiarization } = null) {
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

    if (enableDiarization) {
      useDiarization = enableDiarization;
      // Load speaker verification
      const [verificationProcessor, verificationModel] = await SpeakerVerificationPipeline.getInstance(x => self.postMessage(x)); 
      const verificationInputs = await verificationProcessor(new Float32Array(16000 * 1));
      await verificationModel(verificationInputs)
    }

    self.postMessage({ status: "ready" });
  } catch (error) {
    self.postMessage({ status: "error", error: `Model load/warmup failed: ${error.message}`, stack: error.stack });
  }
}

async function unload() {
  audioQueue = [];
  useDiarization = false;
  speakerEmbeddings = [];
  await SpeakerVerificationPipeline.unloadModel();
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
