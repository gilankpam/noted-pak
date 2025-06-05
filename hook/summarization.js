import { useState, useEffect, useRef, useCallback } from 'react';

export const useSummarization = () => {
  const [summaryText, setSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizationModelReady, setSummarizationModelReady] = useState(false);
  const [summarizationModelLoadingProgress, setSummarizationModelLoadingProgress] = useState('');
  const [summarizationState, setSummarizationState] = useState('answering');

  const summarizationWorkerRef = useRef(null);
  const isLoadingSummarizationModelRef = useRef(false);
  const loadSummarizationModelPromiseRef = useRef(null);

  useEffect(() => {
    summarizationWorkerRef.current = new Worker(new URL('../worker/summarization.worker.js', import.meta.url, {
      type: 'module'
    }));
    summarizationWorkerRef.current.postMessage({ type: 'check_webgpu' });

    summarizationWorkerRef.current.onmessage = (event) => {
      const { status, data, type: messageType, output, file, progress } = event.data;
      const workerState = event.data.state;

      if (workerState) {
        setSummarizationState(workerState);
      }

      switch (status) {
        case 'webgpu_check_success':
          console.log(`WebGPU available. ${data} Ready to load summarization model.`);
          break;
        case 'loading':
          let loadingMsg = data;
          if (file && progress !== undefined) {
            loadingMsg = `Loading ${file}: ${Math.round(progress)}%`;
          } else if (file) {
            loadingMsg = `Loading ${file}...`;
          }
          console.log(loadingMsg);
          setSummarizationModelLoadingProgress(loadingMsg);
          break;
        case 'summarization_ready':
          setSummarizationModelReady(true);
          isLoadingSummarizationModelRef.current = false;
          setSummarizationModelLoadingProgress('Summarization model loaded and ready.');
          console.log('Summarization model loaded and ready.');
          if (loadSummarizationModelPromiseRef.current && loadSummarizationModelPromiseRef.current.resolve) {
            loadSummarizationModelPromiseRef.current.resolve(true); // Resolve the promise for ensureSummarizationModelLoaded
            loadSummarizationModelPromiseRef.current = null;
          }
          break;
        case 'summarizing_started':
          setIsSummarizing(true);
          setSummaryText('');
          console.log(`Summarization started... (${workerState || 'answering'})`);
          break;
        case 'update':
          setSummaryText(prev => prev + output);
          console.log(`Summarizing... (${workerState || 'answering'})`);
          break;
        case 'summarizing_complete':
          setIsSummarizing(false);
          console.log('Summarization complete.');
          setSummarizationState('answering');
          break;
        case 'summarization_interrupted':
          setIsSummarizing(false);
          console.log('Summarization interrupted.');
          setSummarizationState('answering');
          break;
        case 'summarization_reset':
          setSummaryText('');
          console.log('Summarization reset. Ready for new summary.');
          setSummarizationState('answering');
          break;
        case 'error':
          setIsSummarizing(false);
          console.error(`Summarization Worker Error (${messageType}):`, data);
          setSummarizationModelLoadingProgress(`Error: ${data}`); 
          if (messageType === 'load_model_error') {
            setSummarizationModelReady(false); 
            isLoadingSummarizationModelRef.current = false;
            if (loadSummarizationModelPromiseRef.current && loadSummarizationModelPromiseRef.current.reject) {
              loadSummarizationModelPromiseRef.current.reject(new Error(data || 'Failed to load summarization model'));
              loadSummarizationModelPromiseRef.current = null;
            }
          }
          setSummarizationState('answering');
          break;
        default:
          let defaultMsg = status;
          if (file && progress !== undefined) {
            defaultMsg = `Summarizer: ${file} ${Math.round(progress)}%`;
          } else if (file) {
            defaultMsg = `Summarizer: Loading ${file}...`;
          }
          if (defaultMsg) {
            console.log(defaultMsg);
          }
          break;
      }
    };

    return () => {
      if (summarizationWorkerRef.current) {
        summarizationWorkerRef.current.terminate();
        console.log("Summarization worker terminated.");
      }
    };
  }, []);

  const ensureSummarizationModelLoaded = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (summarizationModelReady) {
        resolve(true); 
        return;
      }

      if (isLoadingSummarizationModelRef.current) {
        console.log('Summarization model is currently loading. Please wait.');
        resolve(false); 
        return;
      }

      if (summarizationWorkerRef.current) {
        console.log('Initializing summarization model loading...');
        setSummarizationModelLoadingProgress('Initializing summarization model loading...');
        isLoadingSummarizationModelRef.current = true;
        loadSummarizationModelPromiseRef.current = { resolve, reject };
        summarizationWorkerRef.current.postMessage({ type: 'load_model' });
      } else {
        console.error("Summarization worker not initialized.");
        isLoadingSummarizationModelRef.current = false; 
        reject(new Error('Summarization worker not available.'));
      }
    });
  }, [summarizationModelReady]);

  const handleStartSummarization = useCallback(async (transcriptionText, meetingTitle = '') => {
    if (isSummarizing) {
      console.log('Summarization is already in progress.');
      return;
    }
    if (!transcriptionText || !transcriptionText.trim()) {
      console.log('No transcription text to summarize.');
      return;
    }

    const storedSettings = localStorage.getItem('notedPakSettings');
    let settings = null;
    const defaultSettings = {
        stt: { whisperModel: 'whisper_base_f32' },
        llm: {
            type: 'local',
            localModel: 'llama-3.1-8b',
            openai: { apiToken: '', baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4' },
        },
    };

    if (storedSettings) {
        try {
            const parsedSettings = JSON.parse(storedSettings);
            if (parsedSettings.stt && parsedSettings.llm && parsedSettings.llm.type &&
                parsedSettings.llm.openai && typeof parsedSettings.llm.openai.apiToken === 'string') {
                settings = parsedSettings;
            } else {
                settings = defaultSettings;
                localStorage.setItem('notedPakSettings', JSON.stringify(defaultSettings));
            }
        } catch (error) {
            settings = defaultSettings;
            localStorage.setItem('notedPakSettings', JSON.stringify(defaultSettings));
        }
    } else {
        settings = defaultSettings;
        localStorage.setItem('notedPakSettings', JSON.stringify(defaultSettings));
    }

    let proceedWithSummarization = false;

    if (settings.llm.type === 'local') {
        if (summarizationModelReady) {
            proceedWithSummarization = true;
        } else {
            console.log('Local summarization model not ready. Attempting to load/ensure readiness...');
            try {
                const loadAttemptOutcome = await ensureSummarizationModelLoaded();
                if (loadAttemptOutcome === true) {
                    // Model became ready (either was already, or loaded successfully by this call).
                    proceedWithSummarization = true;
                } else if (loadAttemptOutcome === false) {
                    // Model is being loaded by another call. Do not proceed with this attempt.
                    console.log('Local summarization model is already in the process of loading. Please wait.');
                    return; 
                }
                // If loadAttemptOutcome was neither true nor false, or if an error occurred implicitly,
                // proceedWithSummarization remains false.
            } catch (error) {
                // This catches rejections from ensureSummarizationModelLoaded (e.g., loading initiated by this call failed).
                console.error("Error during summarization model loading:", error.message);
                // UI feedback for loading progress/error is handled by states updated from onmessage.
                return; // Cannot summarize.
            }
        }
    } else { // For 'openai' or other types, we assume ready to proceed (no local model loading needed)
        proceedWithSummarization = true;
    }

    // Final decision point
    if (!proceedWithSummarization) {
        console.log("Summarization cannot proceed: Model (local or other) is not ready or conditions not met.");
        return;
    }

    if (summarizationWorkerRef.current) {
      setSummaryText(''); 
      console.log('Starting summarization with settings:', settings);
      summarizationWorkerRef.current.postMessage({
        type: 'summarize',
        data: {
          transcriptionText: transcriptionText,
          meetingTitle: meetingTitle,
          settings: settings 
        }
      });
    } else {
      console.error("Summarization worker not initialized for summarization.");
    }
  }, [isSummarizing, summarizationModelReady, ensureSummarizationModelLoaded]);
  
  const interruptSummarization = useCallback(() => {
    if (isSummarizing && summarizationWorkerRef.current) {
      summarizationWorkerRef.current.postMessage({ type: 'interrupt_summarization' });
    }
  }, [isSummarizing]);

  return {
    summaryText,
    isSummarizing,
    summarizationModelReady,
    summarizationModelLoadingProgress,
    summarizationState,
    isLoadingSummarizationModelRef,
    handleStartSummarization,
    interruptSummarization,
  };
};
