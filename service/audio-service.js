import { MicVAD } from "@ricky0123/vad-web";

export class AudioService {
  constructor() {
    this.mediaStream = null;
    this.userMicStream = null;
    this.combinedAudioStream = null;
    this.screenAudioSourceNode = null;
    this.micAudioSourceNode = null;
    this.mixedStreamDestinationNode = null;
    this.vad = null;
  }

  async setupVAD(onSpeechStart, onSpeechEnd) {
    try {
      if (this.vad) {
        this.vad.destroy();
        this.vad = null;
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });

      let stream = await this.getMicStream();

      if (navigator.mediaDevices?.getDisplayMedia) {
        const mediaStream = await this.getScreenStream();
        stream = this.createMixedStream(audioContext, mediaStream, stream);
      }

      this.vad = await MicVAD.new({
        stream,
        audioContext,
        positiveSpeechThreshold: 0.7,
        negativeSpeechThreshold: 0.7 - 0.15,
        minSpeechFrames: 3,
        preSpeechPadFrames: 1,
        redemptionFrames: 2,
        onSpeechStart,
        onSpeechEnd
      });

      return true;
    } catch (error) {
      if (error.name === "NotAllowedError") {
        console.info('Screen share or mic is not allowed');
      } else {
        throw error
      }
      return false;
    }
  }

  async getScreenStream() {
    this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { sampleRate: 16000, channelCount: 1 }
    });
    return this.mediaStream;
  }

  async getMicStream() {
    this.userMicStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1 },
      video: false
    });
    return this.userMicStream;
  }

  createMixedStream(audioCtx, screenStream, micStream) {
    try {
      this.screenAudioSourceNode = audioCtx.createMediaStreamSource(screenStream);
      this.micAudioSourceNode = audioCtx.createMediaStreamSource(micStream);
      this.mixedStreamDestinationNode = audioCtx.createMediaStreamDestination();

      this.screenAudioSourceNode.connect(this.mixedStreamDestinationNode);
      this.micAudioSourceNode.connect(this.mixedStreamDestinationNode);

      this.combinedAudioStream = this.mixedStreamDestinationNode.stream;
      return this.combinedAudioStream;
    } catch (error) {
      console.error("Error creating mixed stream:", error);
      return null;
    }
  }

  stopAllStreams() {
    [this.mediaStream, this.userMicStream, this.combinedAudioStream].forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });

    [this.screenAudioSourceNode, this.micAudioSourceNode].forEach(node => {
      if (node) node.disconnect();
    });

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    if (this.vad) {
      this.vad.destroy();
      this.vad = null;
    }

    this.mediaStream = null;
    this.userMicStream = null;
    this.combinedAudioStream = null;
    this.audioContext = null;
    this.screenAudioSourceNode = null;
    this.micAudioSourceNode = null;
    this.mixedStreamDestinationNode = null;
  }

  toggleMic(enabled) {
    if (this.userMicStream) {
      this.userMicStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
    return enabled;
  }

  pauseVAD() {
    if (this.vad) this.vad.pause();
  }

  resumeVAD() {
    if (this.vad) this.vad.start();
  }
}
