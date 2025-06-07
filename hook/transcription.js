import { useState, useEffect, useRef, useCallback } from 'react';
import { MicVAD } from "@ricky0123/vad-web";
import {
  loadModel,
  processAudioChunk,
  isModelLoaded,
  disposeModel
} from '../service/transcription';

export const useTranscription = () => {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [modelReady, setModelReady] = useState(false);
  const [modelLoadingProgress, setModelLoadingProgress] = useState(''); // New state for loading progress
  const [isMicMuted, setIsMicMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false); // New state for pause
  const [isStarting, setIsStarting] = useState(false); // New state to indicate the start process is active

  const mediaStreamRef = useRef(null);
  const userMicStreamRef = useRef(null);
  const combinedAudioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const screenAudioSourceNodeRef = useRef(null);
  const micAudioSourceNodeRef = useRef(null);
  const mixedStreamDestinationNodeRef = useRef(null);
  const vadRef = useRef(null);
  const isProcessingAudioRef = useRef(false);
  const transcriptionUpdateCallbackRef = useRef(null);
  const isTranscribingRef = useRef(isTranscribing);
  const isPausedRef = useRef(isPaused); // New ref for pause state

  useEffect(() => {
    isTranscribingRef.current = isTranscribing;
  }, [isTranscribing]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const handleLoadModel = useCallback((whisperModelName = null) => {
    return new Promise(async (resolve) => {
      if (modelReady && !whisperModelName) {
        console.log('Transcription model already loaded and no specific model name requested.');
        resolve(true);
        return;
      }
      // If a model load is already in progress, and no specific model name is requested now,
      // then let the current load finish.
      if (isProcessingAudioRef.current && !whisperModelName) {
        console.log('Transcription model loading is already in progress.');
        resolve(false); // Indicate that we are not starting a new load
        return;
      }

      isProcessingAudioRef.current = true;
      setModelLoadingProgress(`Initializing transcription model loading${whisperModelName ? ` for ${whisperModelName}` : ''}...`);
      console.log(`Initializing transcription model loading${whisperModelName ? ` for ${whisperModelName}` : ''}...`);

      let finished = false;
      const progressCb = (data) => {
        let message = data.status;
        if (data.file && data.progress !== undefined) {
          message = `Loading ${data.file}: ${Math.round(data.progress)}%`;
        } else if (data.file) {
          message = `Loading ${data.file}...`;
        }
        console.log(message);
        setModelLoadingProgress(message); // Update progress message state

        if (data.status === 'Model loaded successfully. Ready to transcribe.') {
          setModelReady(true);
          setModelLoadingProgress('Transcription model loaded.'); // Final success message
          isProcessingAudioRef.current = false;
          if (!finished) {
            finished = true;
            resolve(true);
          }
        } else if (data.error) {
          console.log(`Error loading transcription model: ${data.error}`);
          setModelLoadingProgress(`Error: ${data.error}`); // Error message
          setModelReady(false);
          isProcessingAudioRef.current = false;
          if (!finished) {
            finished = true;
            resolve(false);
          }
        }
      };

      try {
        await loadModel(progressCb, whisperModelName);
        if (!finished) {
          finished = true;
          resolve(modelReady);
        }
      } catch (error) {
        console.error("Load transcription model promise rejected:", error);
        console.log(`Failed to load transcription model: ${error.message}`);
        setModelReady(false);
        isProcessingAudioRef.current = false;
        if (!finished) {
          finished = true;
          resolve(false);
        }
      }
    });
  }, [modelReady]);

  useEffect(() => {
    if (isModelLoaded()) {
      setModelReady(true);
      console.log('Transcription model is ready.');
    }
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
        case 'complete':
          isProcessingAudioRef.current = false;
          break;
        case 'error':
          console.log(update.message);
          console.error("Transcription service error:", update.message);
          isProcessingAudioRef.current = false;
          break;
        default:
          break;
      }
    };
  }, []);

  const setupVAD = useCallback(async (currentMicMutedState) => {
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
      console.log('Previous VAD instance destroyed.');
    }

    if (screenAudioSourceNodeRef.current) screenAudioSourceNodeRef.current.disconnect();
    if (micAudioSourceNodeRef.current) micAudioSourceNodeRef.current.disconnect();
    screenAudioSourceNodeRef.current = null;
    micAudioSourceNodeRef.current = null;

    if (combinedAudioStreamRef.current) {
      combinedAudioStreamRef.current.getTracks().forEach(track => track.stop());
      combinedAudioStreamRef.current = null;
    }
    mixedStreamDestinationNodeRef.current = null;

    const audioCtx = audioContextRef.current;
    if (!audioCtx || audioCtx.state === 'closed') {
      console.log('AudioContext not ready. Cannot setup VAD.');
      console.error('AudioContext not ready for VAD setup.');
      return false;
    }

    let streamForVAD = null;
    const screenAudioActive = mediaStreamRef.current && mediaStreamRef.current.active && mediaStreamRef.current.getAudioTracks().length > 0 && mediaStreamRef.current.getAudioTracks()[0].enabled;
    const micAudioActiveAndUnmuted = userMicStreamRef.current && userMicStreamRef.current.active && !currentMicMutedState && userMicStreamRef.current.getAudioTracks().length > 0 && userMicStreamRef.current.getAudioTracks()[0].enabled;

    console.log(`setupVAD called. screenAudioActive: ${screenAudioActive}, micAudioActiveAndUnmuted (based on currentMicMutedState: ${!currentMicMutedState}): ${micAudioActiveAndUnmuted}`);

    if (screenAudioActive && micAudioActiveAndUnmuted) {
      console.log("Attempting to set up VAD with mixed audio (screen + mic).");
      try {
        screenAudioSourceNodeRef.current = audioCtx.createMediaStreamSource(mediaStreamRef.current);
        micAudioSourceNodeRef.current = audioCtx.createMediaStreamSource(userMicStreamRef.current);
        mixedStreamDestinationNodeRef.current = audioCtx.createMediaStreamDestination();

        screenAudioSourceNodeRef.current.connect(mixedStreamDestinationNodeRef.current);
        micAudioSourceNodeRef.current.connect(mixedStreamDestinationNodeRef.current);
        
        combinedAudioStreamRef.current = mixedStreamDestinationNodeRef.current.stream;
        streamForVAD = combinedAudioStreamRef.current;
      } catch (mixError) {
        console.error("Error creating mixed audio stream:", mixError);
        console.log(`Error mixing audio: ${mixError.message}`);
        return false;
      }
    } else if (screenAudioActive) {
      console.log("Setting up VAD with screen audio only.");
      streamForVAD = mediaStreamRef.current;
    } else if (micAudioActiveAndUnmuted) {
      console.log("Attempting to set up VAD with microphone audio only.");
      streamForVAD = userMicStreamRef.current;
    } else {
      console.log("No active audio streams for VAD (or mic is muted). VAD will not start processing new audio unless screen audio is active.");
      console.log(screenAudioActive ? "Mic is muted. Using screen audio only for VAD." : "No active audio source for VAD.");
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
      return true;
    }
    
    if (!streamForVAD) {
        console.log("Stream for VAD is null after selection logic, VAD will not start.");
        console.log("Failed to prepare audio stream for VAD.");
        if (vadRef.current) {
            vadRef.current.destroy();
            vadRef.current = null;
        }
        if (screenAudioActive && !micAudioActiveAndUnmuted) {
            console.log("Setting up VAD with screen audio only (mic is muted or unavailable).");
            streamForVAD = mediaStreamRef.current;
        } else if (!screenAudioActive && !micAudioActiveAndUnmuted && vadRef.current) {
            console.log("No active streams, ensuring VAD is stopped.");
            vadRef.current.destroy();
            vadRef.current = null;
            console.log("No active audio source. VAD stopped.");
            return true;
        }
    }

    if (streamForVAD) {
        console.log(`VAD will attempt to use stream ID: ${streamForVAD.id}. Active: ${streamForVAD.active}. Tracks: ${streamForVAD.getAudioTracks().length}`);
    } else {
        console.log("VAD will not be started, streamForVAD is null after selection logic.");
        if (vadRef.current) {
            vadRef.current.destroy();
            vadRef.current = null;
        }
        console.log("No suitable audio stream for VAD. VAD stopped.");
        return true;
    }
    
    try {
      console.log("Attempting to create new MicVAD instance with selected stream.");
      const vad = await MicVAD.new({
        stream: streamForVAD,
        audioContext: audioCtx,
        positiveSpeechThreshold: 0.7,
        negativeSpeechThreshold: 0.7 - 0.15,
        minSpeechFrames: 3,
        preSpeechPadFrames: 1,
        redemptionFrames: 2,
        onSpeechStart: () => {
          console.log("VAD: Speech started");
          console.log("VAD: Speech detected...");
        },
        onSpeechEnd: (audio) => {
          console.log(`VAD: Speech ended. Audio data length: ${audio.length}`);
          if (audio.length > 0 && isTranscribingRef.current && !isPausedRef.current) {
            console.log("VAD processing");
            processAudioChunk(audio, 'en', transcriptionUpdateCallbackRef.current);
          } else if (audio.length === 0) {
            console.log("VAD: Speech ended but no audio data captured (or too short).");
          } else if (isPausedRef.current) {
            console.log("VAD: Speech ended, but transcription is paused. Audio ignored.");
          }
        },
      });
      vadRef.current = vad;
      // Conditional VAD start based on paused state
      if (!isPausedRef.current) {
        vad.start();
        console.log("VAD (re)started successfully with the new stream configuration.");
        console.log(`VAD active. Mic ${currentMicMutedState ? "muted" : "unmuted"}.`);
      } else {
        console.log("VAD configured, but remains paused.");
        // If VAD auto-starts, we might need vad.pause() here. Assuming MicVAD needs explicit start.
        console.log(`VAD ready (paused). Mic ${currentMicMutedState ? "muted" : "unmuted"}.`);
      }
      return true;
    } catch (error) {
      console.error("Error (re)initializing VAD with the new stream:", error);
      console.log(`Error setting up VAD: ${error.message}`);
      if (vadRef.current) {
        vadRef.current.destroy();
        vadRef.current = null;
      }
      if (combinedAudioStreamRef.current) {
          combinedAudioStreamRef.current.getTracks().forEach(track => track.stop());
          combinedAudioStreamRef.current = null;
      }
      if (screenAudioSourceNodeRef.current) screenAudioSourceNodeRef.current.disconnect();
      if (micAudioSourceNodeRef.current) micAudioSourceNodeRef.current.disconnect();
      return false;
    }
  }, []); 

  const handleStopTranscription = useCallback(() => {
    if (!isTranscribingRef.current && !mediaStreamRef.current && !userMicStreamRef.current && !vadRef.current) {
      return;
    }
    console.log('Stopping transcription and cleaning up resources...');
    
    setIsTranscribing(false);
    
    if (vadRef.current) {
      vadRef.current.destroy();
      vadRef.current = null;
      console.log('VAD destroyed.');
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
      console.log('Screen share mediaStream tracks stopped.');
    }
    if (userMicStreamRef.current) {
      userMicStreamRef.current.getTracks().forEach(track => track.stop());
      userMicStreamRef.current = null;
      console.log('User microphone stream tracks stopped.');
    }
    if (combinedAudioStreamRef.current) {
        combinedAudioStreamRef.current.getTracks().forEach(track => track.stop());
        combinedAudioStreamRef.current = null;
        console.log('Combined audio stream stopped.');
    }
    if (screenAudioSourceNodeRef.current) {
      screenAudioSourceNodeRef.current.disconnect();
      screenAudioSourceNodeRef.current = null;
    }
    if (micAudioSourceNodeRef.current) {
      micAudioSourceNodeRef.current.disconnect();
      micAudioSourceNodeRef.current = null;
    }
    mixedStreamDestinationNodeRef.current = null;
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        console.log('AudioContext closed.');
        audioContextRef.current = null;
      }).catch(err => {
        console.error('Error closing AudioContext:', err);
        audioContextRef.current = null;
      });
    } else if (audioContextRef.current && audioContextRef.current.state === 'closed') {
      console.log('AudioContext was already closed.');
      audioContextRef.current = null;
    }
    
    isProcessingAudioRef.current = false;
    setIsMicMuted(true);
    setIsPaused(false); // Ensure not paused when stopping
    disposeModel();
    console.log('Transcription stopped. Resources cleaned up.');
  }, [setIsTranscribing, setIsMicMuted, setIsPaused]);


  const handleStartTranscription = useCallback(async () => {
    setIsStarting(true);
    try {
      if (isTranscribingRef.current) {
        console.log('Transcription is already in progress.');
        return;
      }

      const settingsString = localStorage.getItem('notedPakSettings');
      let whisperModelNameToLoad = null; // Changed variable name
      if (settingsString) {
        try {
          const parsedSettings = JSON.parse(settingsString);
          if (parsedSettings.stt && parsedSettings.stt.whisperModel) {
            whisperModelNameToLoad = parsedSettings.stt.whisperModel;
          }
        } catch (e) {
          console.error("Failed to parse settings for starting transcription:", e);
        }
      }
      
      console.log(`Attempting to load model by name: ${whisperModelNameToLoad || 'default'}. Current modelReady: ${modelReady}`);
      const loaded = await handleLoadModel(whisperModelNameToLoad);
      if (!loaded) {
        console.log('Failed to load transcription model. Cannot start transcription.');
        return;
      }
      // After handleLoadModel, modelReady should be true if successful.

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        try {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000,
          });
          console.log('AudioContext created/recreated.');
        } catch (e) {
          console.error("Failed to create AudioContext:", e);
          console.log(`Audio system error: ${e.message}. Cannot start transcription.`);
          // setIsStarting(false); // Handled by finally
          return;
        }
      }

      console.log('Requesting screen share permission...');
      // At this point, model is loaded. Now try to get media.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { sampleRate: 16000, channelCount: 1 }
      });
      mediaStreamRef.current = stream;

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled || audioTracks[0].muted) {
        console.log('Error: No active audio track from screen share. Ensure "Share tab audio" is checked and audio is playing.');
        console.error('No active audio track found in screen share.');
        stream.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        // setIsStarting(false); // Handled by finally
        return;
      }
      
      console.log('Screen share audio stream acquired.');
      setIsTranscribing(true); // Critical: set this before VAD setup that might use isTranscribingRef
      setTranscription('');
      setIsMicMuted(true);
      setIsPaused(false); 

      const vadSetupSuccess = await setupVAD(true); 
      if (!vadSetupSuccess) {
          console.error("VAD setup failed during start transcription.");
          // handleStopTranscription will call setIsTranscribing(false)
          // and other cleanup.
          handleStopTranscription(); 
          console.log("Failed to initialize audio processing. Transcription stopped.");
          // setIsStarting(false); // Handled by finally
          return; 
      }

      mediaStreamRef.current.getTracks().forEach(track => {
        track.onended = () => {
          console.log('Screen share media stream track ended.');
          if (isTranscribingRef.current) {
            console.log("Screen share ended. Stopping transcription.");
            handleStopTranscription();
          }
        };
      });

      console.log('Transcription started. Share a tab with audio. Mic is initially muted.');

    } catch (error) {
      console.error('Error starting transcription:', error);
      console.log(`Error starting transcription: ${error.message}.`);
      // Ensure cleanup if error occurs at any point (e.g. getDisplayMedia rejected by user)
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      setIsTranscribing(false); // Ensure we are not in transcribing state
      // Other states like isMicMuted, isPaused should be reset if needed,
      // handleStopTranscription could be called here if appropriate, but it might be too broad.
      // For now, just ensure isTranscribing is false.
    } finally {
      setIsStarting(false);
    }
  }, [modelReady, handleLoadModel, setupVAD, handleStopTranscription, setIsTranscribing, setTranscription, setIsMicMuted, setIsPaused]);

  const handlePauseTranscription = useCallback(() => {
    if (!isTranscribingRef.current || isPausedRef.current) {
      console.log(isPausedRef.current ? 'Transcription is already paused.' : 'Transcription is not active to pause.');
      return;
    }
    if (vadRef.current) {
      vadRef.current.pause();
      console.log('VAD paused.');
    }
    setIsPaused(true);
    console.log('Transcription paused.');
  }, [setIsPaused]);

  const handleResumeTranscription = useCallback(() => {
    if (!isTranscribingRef.current || !isPausedRef.current) {
      console.log(!isPausedRef.current ? 'Transcription is not paused.' : 'Transcription is not active to resume.');
      return;
    }
    if (vadRef.current) {
      // Ensure VAD is started if it was configured but not started due to being paused
      vadRef.current.start(); 
      console.log('VAD resumed.');
    }
    setIsPaused(false);
    console.log('Transcription resumed.');
  }, [setIsPaused]);

  const handleToggleMic = useCallback(async () => {
    if (!isTranscribingRef.current) {
      console.log("Cannot toggle mic. Transcription is not active.");
      return;
    }
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      console.log("Audio system not ready. Cannot toggle mic.");
      console.error("AudioContext not ready for mic toggle.");
      return;
    }

    let newMutedState;

    if (isMicMuted) { // Unmute
      try {
        if (!userMicStreamRef.current || !userMicStreamRef.current.active) {
          console.log("Requesting microphone access for unmute...");
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 }, video: false });
          userMicStreamRef.current = stream;
          console.log("Microphone stream acquired for unmute.");
        }
        userMicStreamRef.current.getAudioTracks().forEach(track => track.enabled = true);
        newMutedState = false;
        setIsMicMuted(false); 
        console.log("Mic tracks enabled, state set to unmuted.");
      } catch (err) {
        console.error("Error accessing microphone during unmute attempt:", err);
        console.log(`Error accessing microphone: ${err.message}`);
        if (userMicStreamRef.current) {
            userMicStreamRef.current.getTracks().forEach(track => track.stop());
            userMicStreamRef.current = null;
        }
        newMutedState = true;
        setIsMicMuted(true); 
        await setupVAD(newMutedState);
        return; 
      }
    } else { // Mute
      if (userMicStreamRef.current && userMicStreamRef.current.active) {
        userMicStreamRef.current.getAudioTracks().forEach(track => track.enabled = false);
        console.log("Microphone tracks disabled (for muting).");
      }
      newMutedState = true;
      setIsMicMuted(true);
      console.log("State set to muted.");
    }
  
    console.log(`Calling setupVAD with newMutedState: ${newMutedState}`);
    await setupVAD(newMutedState);
  }, [isMicMuted, setupVAD, setIsMicMuted]);

  return {
    isTranscribing,
    transcription,
    modelReady,
    isMicMuted,
    isPaused, // Expose new state
    modelLoadingProgress, // Expose new state
    isStarting, // Expose new state
    isProcessingAudioRef, // Expose if App needs it (e.g. for disabling buttons)
    handleStartTranscription,
    handleStopTranscription,
    handlePauseTranscription, // Expose new handler
    handleResumeTranscription, // Expose new handler
    handleToggleMic,
  };
};
