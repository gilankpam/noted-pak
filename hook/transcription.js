import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioService } from '../service/audio-service';
import { TranscriptionService } from '../service/transcription';

export const useTranscription = () => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [modelLoadingProgress, setModelLoadingProgress] = useState('');
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const audioServiceRef = useRef(new AudioService());
  const transcriptionServiceRef = useRef(new TranscriptionService());
  const transcriptionUpdateCallbackRef = useRef(null);
  const isTranscribingRef = useRef(isTranscribing);
  const isPausedRef = useRef(isPaused); // New ref for pause state

  useEffect(() => {
    isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const handleLoadModel = useCallback(async (whisperModelName = null, enableDiarization = false) => {
    return transcriptionServiceRef.current.loadModel(
      (data) => {
        if (data.status === 'progress') {
          const progressText = `Downloading ${data.name}/${data.file}: ${Math.round(data.progress)}%`;
          setModelLoadingProgress(progressText);
        }
        if (data.status === TranscriptionService.MODEL_STATE_ENUM.READY) {
          setModelReady(true);
        }
      },
      whisperModelName,
      enableDiarization
    );
  }, []);

  useEffect(() => {
    transcriptionUpdateCallbackRef.current = (update) => {
      switch (update.type) {
        case 'start':
          break;
        case 'update':
          if (update.text !== undefined) {
            setTranscription(prevTranscription => prevTranscription + (prevTranscription ? " " : "") + update.text);
          }
          break;
        case 'error':
          console.error("Transcription service error:", update.message);
          break;
        default:
          break;
      }
    };
  }, []);

  const handleStopTranscription = useCallback(() => {
    if (!isTranscribingRef.current) return;
    
    setIsTranscribing(false);
    
    audioServiceRef.current.stopAllStreams();
    transcriptionServiceRef.current.dispose();
        
    setIsMicMuted(true);
    setIsPaused(false);
  }, [setIsTranscribing, setIsMicMuted, setIsPaused]);


  const handleStartTranscription = useCallback(async () => {
    setIsStarting(true);
    try {
      if (isTranscribingRef.current) return;
      
      const settings = JSON.parse(localStorage.getItem('notedPakSettings') || '{}');
      const sttSettings = settings.stt || {};
      
      const loaded = await handleLoadModel(
        sttSettings.whisperModel,
        sttSettings.enableDiarization
      );

      if (!loaded) return;

      setIsTranscribing(true);
      setTranscription('');
      setIsPaused(false);
      
      const vadSuccess = await audioServiceRef.current.setupVAD(
        () => console.log("VAD: Speech detected..."),
        (audio) => {
          if (audio.length > 0 && isTranscribingRef.current && !isPausedRef.current) {
            console.log('VAD: Processing audio');
            transcriptionServiceRef.current.processAudio(
              audio,
              'en',
              transcriptionUpdateCallbackRef.current
            );
          }
        }
      );

      if (!vadSuccess) {
        handleStopTranscription();
        return;
      }

      audioServiceRef.current.toggleMic(!isMicMuted);
      audioServiceRef.current.resumeVAD();
    } catch (error) {
      console.error('Error starting transcription:', error);
      setIsTranscribing(false);
    } finally {
      setIsStarting(false);
    }
  }, [handleLoadModel, handleStopTranscription, isMicMuted]);

  const handlePauseTranscription = useCallback(() => {
    if (!isTranscribingRef.current || isPausedRef.current) return;
    audioServiceRef.current.pauseVAD();
    setIsPaused(true);
  }, [setIsPaused]);

  const handleResumeTranscription = useCallback(() => {
    if (!isTranscribingRef.current || !isPausedRef.current) return;
    audioServiceRef.current.resumeVAD();
    setIsPaused(false);
  }, [setIsPaused]);

  const handleToggleMic = useCallback(async () => {
    if (!isTranscribingRef.current) return;
    
    const newMutedState = !isMicMuted;
    setIsMicMuted(newMutedState);
    
    if (newMutedState) {
      audioServiceRef.current.toggleMic(false);
    } else {
      audioServiceRef.current.toggleMic(true);
    }
    
  }, [isMicMuted]);

  return {
    isTranscribing,
    transcription,
    modelReady,
    isMicMuted,
    isPaused, // Expose new state
    modelLoadingProgress, // Expose new state
    isStarting, // Expose new state
    handleStartTranscription,
    handleStopTranscription,
    handlePauseTranscription, // Expose new handler
    handleResumeTranscription, // Expose new handler
    handleToggleMic,
  };
};
