import { useState, useEffect, useRef, useCallback } from 'react';

export const useSummarization = () => {
  const [summaryText, setSummaryText] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizationModelReady, setSummarizationModelReady] = useState(true);
  const [summarizationModelLoadingProgress, setSummarizationModelLoadingProgress] = useState('');
  const [summarizationState, setSummarizationState] = useState('answering');
  const [isLoadingSummarizationModel, setIsLoadingSummarizationModel] = useState(false);

  const summarizationWorkerRef = useRef(null);
  const loadSummarizationModelPromiseRef = useRef(null);

  useEffect(() => {
    summarizationWorkerRef.current = new Worker(new URL('../public/worker/summarization.js', import.meta.url), {
      type: 'module'
    });
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
        case 'summarizing_started':
          setIsSummarizing(true);
          setSummaryText('');
          setIsLoadingSummarizationModel(false);
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
            setIsLoadingSummarizationModel(false);
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

    if (summarizationWorkerRef.current) {
      setSummaryText('');
      setIsLoadingSummarizationModel(true);
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
  }, [isSummarizing, summarizationModelReady]);
  
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
    isLoadingSummarizationModel,
    handleStartSummarization,
    interruptSummarization,
  };
};
