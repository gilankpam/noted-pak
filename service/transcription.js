// src/transcriptionService.js

let worker = null;
let modelState = 'unloaded'; // 'unloaded', 'loading', 'ready', 'error'
let onUpdateCallback = null; // For App.js to receive transcription updates
let onLoadProgressCallback = null; // For App.js to receive loading progress

const initializeWorker = () => {
  if (!worker) {
    worker = new Worker(new URL('../public/worker/transcription.js', import.meta.url), {
      type: 'module'
    });

    worker.onmessage = (event) => {
      const { status, output, error, data, stack } = event.data;

      switch (status) {
        case 'loading':
          modelState = 'loading';
          if (onLoadProgressCallback) onLoadProgressCallback({ status: data || 'Loading model resources...' });
          break;
        case 'ready':
          modelState = 'ready';
          if (onLoadProgressCallback) onLoadProgressCallback({ status: 'Model loaded successfully. Ready to transcribe.' });
          break;
        case 'start':
          if (onUpdateCallback) onUpdateCallback({ type: 'start', message: 'Worker reported: Transcription process started.' });
          break;
        case 'update': // Live transcription update
          if (onUpdateCallback && typeof output === 'string') { // Ensure output is a string
            // Worker sends incremental chunks (e.g., words). Accumulate them.
            if (output.trim() === "") { // Avoid adding empty strings or just spaces
                return;
            }

            // Send the full accumulated transcript
            onUpdateCallback({
              type: 'update',
              text: output.trim(),
            });
          }
          break;
        case 'complete': // Transcription of a chunk/segment is complete
          if (onUpdateCallback) onUpdateCallback({ type: 'complete', message: 'Segment processed.' });
          break;
        case 'busy':
          console.warn('Transcription worker is busy.');
          if (onUpdateCallback) onUpdateCallback({ type: 'error', message: 'Worker is busy. Please wait.' });
          break;
        case 'error':
          modelState = 'error';
          console.error('Error from worker:', error, stack);
          if (onLoadProgressCallback && (modelState !== 'ready')) { // If error during loading
            onLoadProgressCallback({ status: `Error: ${error}`, error: true });
          } else if (onUpdateCallback) { // If error during transcription
            onUpdateCallback({ type: 'error', message: `Transcription error: ${error}` });
          }
          break;
        default:
          // Handle other progress messages from from_pretrained if they have a 'status' field
          if (event.data.status && onLoadProgressCallback && modelState === 'loading') {
            onLoadProgressCallback(event.data);
          }
          break;
      }
    };

    worker.onerror = (err) => {
      console.error('Unhandled error in transcription worker:', err);
      modelState = 'error';
      if (onLoadProgressCallback) {
        onLoadProgressCallback({ status: `Worker error: ${err.message}`, error: true });
      } else if (onUpdateCallback) {
        onUpdateCallback({ type: 'error', message: `Worker error: ${err.message}` });
      }
      // Consider terminating and nullifying the worker for a clean restart
      worker.terminate();
      worker = null;
    };
  }
};

export const loadModel = async (progressCb, modelName = null) => { // Changed modelName to modelSlug
  initializeWorker();
  onLoadProgressCallback = progressCb;

  if (modelName) {
    console.log(`transcriptionService: loadModel called for specific model name: ${modelName}`);
    modelState = 'loading';
    worker.postMessage({ type: 'load', data: { modelName } });
  } else {
    // If no specific modelSlug, check current state
    if (modelState === 'ready') {
      if (onLoadProgressCallback) onLoadProgressCallback({ status: 'Model already loaded.' });
      return true;
    }
    if (modelState === 'loading') {
      if (onLoadProgressCallback) onLoadProgressCallback({ status: 'Model loading is already in progress.' });
      return false;
    }
    modelState = 'loading';
    worker.postMessage({ type: 'load' }); // Load default model
  }

  return new Promise((resolve, reject) => {
    const originalCb = onLoadProgressCallback;

    const tempOnLoad = (data) => {
      if (data.status === 'ready') {
        resolve(true);
      } else if (data.error) {
        reject(new Error(data.status));
      }
      onLoadProgressCallback = originalCb
    };

    // Augment the existing callback
    onLoadProgressCallback = (data) => {
        if(originalCb) originalCb(data);
        tempOnLoad(data);
    };
  });
};

// audioData should be a Float32Array, resampled to 16kHz mono
export const processAudioChunk = (audioData, language, updateCb) => {
  if (modelState !== 'ready' || !worker) {
    console.warn('Model not ready or worker not initialized.');
    if (updateCb) updateCb({ type: 'error', message: 'Model not ready.' });
    return;
  }
  onUpdateCallback = updateCb;

  worker.postMessage({
    type: 'generate',
    data: {
      audio: audioData, // This is the Float32Array
      language: language || 'en', // Default language if not provided
    }
  }, [audioData.buffer]); // Transfer the underlying ArrayBuffer
};

export const isModelLoaded = () => {
  return modelState === 'ready';
};

export const disposeModel = async () => {
  if (worker) {
    worker.terminate();
    worker = null;
    modelState = 'unloaded';
    console.log('Transcription worker terminated.');
  }
  onUpdateCallback = null;
  onLoadProgressCallback = null;
};
