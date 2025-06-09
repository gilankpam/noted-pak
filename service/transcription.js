// Define model state enum
export class TranscriptionService {
  static MODEL_STATE_ENUM = {
    UNLOADED: 'unloaded',
    LOADING: 'loading',
    READY: 'ready',
    ERROR: 'error'
  };

  constructor() {
    this.worker = null;
    this.modelState = TranscriptionService.MODEL_STATE_ENUM.UNLOADED;
    this.onUpdateCallback = null;
    this.onLoadProgressCallback = null;
    this.lastSpeakerId = null;
  }

  _initializeWorker() {
    this.worker = new Worker(new URL('../public/worker/transcription.js', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = (event) => {
      const { status, output, speaker_id, error, stack } = event.data;

      switch (status) {
        case 'progress':
          this.modelState = TranscriptionService.MODEL_STATE_ENUM.LOADING;
          if (this.onLoadProgressCallback) {
            this.onLoadProgressCallback(event.data);
          }
          break;
        case 'ready':
          this.modelState = TranscriptionService.MODEL_STATE_ENUM.READY;
          if (this.onLoadProgressCallback) {
            this.onLoadProgressCallback({ status: TranscriptionService.MODEL_STATE_ENUM.READY });
          }
          break;
        case 'start':
          if (this.onUpdateCallback) {
            this.onUpdateCallback({ type: 'start' });
          }
          break;
        case 'update':
          if (this.onUpdateCallback && typeof output === 'string') {
            if (output.trim() === "") return;
            
            let outputText = output.trim();
            if (speaker_id !== null && this.lastSpeakerId !== speaker_id) {
              outputText = `\nSPEAKER_${speaker_id}: ${outputText}`;
              this.lastSpeakerId = speaker_id;
            }

            this.onUpdateCallback({
              type: 'update',
              text: outputText,
            });
          }
          break;
        case 'error':
          this.modelState = TranscriptionService.MODEL_STATE_ENUM.ERROR;
          console.error('Error from worker:', error, stack);
          
          if (this.onLoadProgressCallback && (this.modelState !== TranscriptionService.MODEL_STATE_ENUM.READY)) {
            this.onLoadProgressCallback({ status: TranscriptionService.MODEL_STATE_ENUM.ERROR, error: error });
          } else if (this.onUpdateCallback) {
            this.onUpdateCallback({ type: 'error', message: `Transcription error: ${error}` });
          }
          break;
      }
    };

    this.worker.onerror = (err) => {
      console.error('Unhandled error in transcription worker:', err);
      this.modelState = TranscriptionService.MODEL_STATE_ENUM.ERROR;
      
      if (this.onLoadProgressCallback) {
        this.onLoadProgressCallback({ status: TranscriptionService.MODEL_STATE_ENUM.ERROR, error: err });
      } else if (this.onUpdateCallback) {
        this.onUpdateCallback({ type: 'error', message: `Worker error: ${err.message}` });
      }
    };
  }

  async loadModel(progressCb, modelName = null, enableDiarization = false) {
    this.onLoadProgressCallback = progressCb;

    // Initialize worker only when needed and in browser environment
    if (!this.worker && typeof Worker !== 'undefined') {
      this._initializeWorker();
    }

    return new Promise((resolve, reject) => {
      const originalCb = this.onLoadProgressCallback;
      this.onLoadProgressCallback = (data) => {
        if (originalCb) originalCb(data);
        if (data.status === TranscriptionService.MODEL_STATE_ENUM.READY) {
          resolve(true);
        } else if (data.error) {
          reject(new Error(data.status));
        }
      };

      if (this.modelState === TranscriptionService.MODEL_STATE_ENUM.READY) {
        this.onLoadProgressCallback({ status: TranscriptionService.MODEL_STATE_ENUM.READY });
        resolve(true);
        return;
      }
      if (this.modelState === TranscriptionService.MODEL_STATE_ENUM.LOADING) {
        this.onLoadProgressCallback({ status: TranscriptionService.MODEL_STATE_ENUM.LOADING });
        resolve(false);
        return;
      }

      this.modelState = TranscriptionService.MODEL_STATE_ENUM.LOADING;
      this.worker.postMessage({ type: 'load', data: { modelName, enableDiarization } });
    });
  }

  processAudio(audio, language, callback) {
    if (typeof Worker === 'undefined') {
      console.error('Worker not available in this environment');
      if (callback) callback({ type: 'error', message: 'Worker not available in this environment' });
      return;
    }
    
    if (this.modelState !== TranscriptionService.MODEL_STATE_ENUM.READY) {
      console.warn('Model not ready or worker not initialized.');
      if (callback) callback({ type: 'error', message: 'Model not ready.' });
      return;
    }
    
    this.onUpdateCallback = callback;
    
    this.worker.postMessage({
      type: 'generate',
      data: {
        audio: audio,
        language: language || 'en',
      }
    }, [audio.buffer]);
  }

  get modelReady() {
    return this.modelState === TranscriptionService.MODEL_STATE_ENUM.READY;
  }

  dispose() {
    if (this.worker) {
      this.worker.postMessage({ type: 'unload' });
    }
    this.modelState = TranscriptionService.MODEL_STATE_ENUM.UNLOADED;
  }
}
