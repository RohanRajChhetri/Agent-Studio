/**
 * Google ADK & Gemini Multimodal Live API Client
 * Bidirectional low-latency real-time voice streaming over WebSockets.
 * Audio specs: 16kHz PCM mono input, 24kHz PCM mono output.
 */

export interface GeminiLiveCallbacks {
  onStatusChange?: (status: "connecting" | "ready" | "listening" | "speaking" | "error" | "closed") => void;
  onTranscriptChunk?: (text: string, isModel: boolean) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onError?: (error: Error | string) => void;
  onVolumeChange?: (micVol: number, speakerVol: number) => void;
}

export interface GeminiLiveConfig {
  apiKey: string;
  model?: string;
  voiceName?: "Puck" | "Aoede" | "Charon" | "Fenrir" | "Kore" | string;
  systemInstruction?: string;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private callbacks: GeminiLiveCallbacks;

  // Web Audio Contexts & Streams
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private speakerAnalyser: AnalyserNode | null = null;

  // Playback scheduling
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isSpeaking = false;
  private isMuted = false;
  private isClosed = false;

  // Animation frame for audio volume telemetry
  private animFrameId: number | null = null;

  constructor(config: GeminiLiveConfig, callbacks: GeminiLiveCallbacks = {}) {
    this.config = {
      model: "models/gemini-2.0-flash-exp",
      voiceName: "Puck",
      ...config,
    };
    this.callbacks = callbacks;
  }

  /**
   * Connect to Gemini Live WebSocket and start bidirectional audio pipeline
   */
  public async start(): Promise<void> {
    if (typeof window === "undefined") return;

    this.isClosed = false;
    this.callbacks.onStatusChange?.("connecting");

    try {
      // 1. Initialize Audio Contexts
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });

      // Create Analyser nodes
      this.micAnalyser = this.inputAudioCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      this.speakerAnalyser = this.outputAudioCtx.createAnalyser();
      this.speakerAnalyser.fftSize = 256;

      // Start volume telemetry loop
      this.startTelemetryLoop();

      // 2. Open WebSocket to Gemini Live API
      const endpoint = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(
        this.config.apiKey
      )}`;

      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.sendInitialHandshake();
        this.startMicrophoneStream();
      };

      this.ws.onmessage = async (event: MessageEvent) => {
        try {
          let msgText: string;
          if (event.data instanceof Blob) {
            msgText = await event.data.text();
          } else {
            msgText = event.data;
          }
          this.handleServerMessage(JSON.parse(msgText));
        } catch (err) {
          console.warn("[GeminiLive] Failed to parse message:", err);
        }
      };

      this.ws.onerror = (err) => {
        console.error("[GeminiLive] WebSocket error:", err);
        this.callbacks.onError?.("Gemini Live WebSocket connection encountered an error");
        this.callbacks.onStatusChange?.("error");
      };

      this.ws.onclose = (ev) => {
        if (!this.isClosed) {
          console.warn("[GeminiLive] WebSocket closed:", ev.code, ev.reason);
          this.callbacks.onStatusChange?.("closed");
        }
      };
    } catch (err) {
      console.error("[GeminiLive] Initialization failed:", err);
      const errMsg = err instanceof Error ? err.message : "Initialization failed";
      this.callbacks.onError?.(errMsg);
      this.callbacks.onStatusChange?.("error");
      throw err;
    }
  }

  /**
   * Send Google ADK setup message
   */
  private sendInitialHandshake() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const setupMsg = {
      setup: {
        model: this.config.model || "models/gemini-2.0-flash-exp",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.config.voiceName || "Puck",
              },
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text:
                this.config.systemInstruction ||
                "You are an expert real-time voice AI agent. Speak naturally, conversationally, and concisely in 1 to 3 short sentences.",
            },
          ],
        },
      },
    };

    this.ws.send(JSON.stringify(setupMsg));
    this.callbacks.onStatusChange?.("ready");
  }

  /**
   * Start microphone capture and 16kHz PCM streaming
   */
  private async startMicrophoneStream() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!this.inputAudioCtx || !this.micAnalyser) return;

      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.micAnalyser);

      // Script processor to capture 16kHz raw PCM
      const bufferSize = 1024;
      this.micProcessor = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);

      this.micProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32Array to 16-bit PCM little endian
        const pcm16 = this.floatTo16BitPCM(inputData);
        const base64Data = this.arrayBufferToBase64(pcm16);

        // Send realtime audio media chunk
        const clientMsg = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Data,
              },
            ],
          },
        };

        this.ws.send(JSON.stringify(clientMsg));
      };

      this.micAnalyser.connect(this.micProcessor);
      this.micProcessor.connect(this.inputAudioCtx.destination);
      this.callbacks.onStatusChange?.("listening");
    } catch (err) {
      console.error("[GeminiLive] Mic access error:", err);
      this.callbacks.onError?.("Microphone permission denied or unavailable");
    }
  }

  /**
   * Handle server messages from Gemini Live
   */
  private handleServerMessage(msg: {
    serverContent?: {
      modelTurn?: {
        parts?: Array<{
          mimeType?: string;
          data?: string;
          text?: string;
        }>;
      };
      turnComplete?: boolean;
      interrupted?: boolean;
    };
  }) {
    // 1. Server content containing model turn
    if (msg.serverContent) {
      const { modelTurn, turnComplete, interrupted } = msg.serverContent;

      if (interrupted) {
        this.interruptPlayback();
        this.callbacks.onInterrupted?.();
        this.callbacks.onStatusChange?.("listening");
        return;
      }

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          // Real-time audio part (24kHz PCM)
          if (part.mimeType && part.mimeType.startsWith("audio/pcm") && part.data) {
            this.queueAudioPlayback(part.data);
          }

          // Text transcript part
          if (part.text) {
            this.callbacks.onTranscriptChunk?.(part.text, true);
          }
        }
      }

      if (turnComplete) {
        this.callbacks.onTurnComplete?.();
      }
    }
  }

  /**
   * Queue 24kHz PCM audio chunk for gapless playback
   */
  private queueAudioPlayback(base64Data: string) {
    if (!this.outputAudioCtx || !this.speakerAnalyser) return;

    try {
      // Resume output audio context if suspended by browser autoplay policy
      if (this.outputAudioCtx.state === "suspended") {
        this.outputAudioCtx.resume();
      }

      const pcmBytes = this.base64ToArrayBuffer(base64Data);
      const float32Data = this.pcm16ToFloat32(pcmBytes);

      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.speakerAnalyser);
      this.speakerAnalyser.connect(this.outputAudioCtx.destination);

      const now = this.outputAudioCtx.currentTime;
      const startTime = Math.max(now, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.push(source);
      this.isSpeaking = true;
      this.callbacks.onStatusChange?.("speaking");

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) this.activeSources.splice(idx, 1);

        if (this.activeSources.length === 0) {
          this.isSpeaking = false;
          this.callbacks.onStatusChange?.("listening");
        }
      };
    } catch (err) {
      console.warn("[GeminiLive] Audio decode/playback error:", err);
    }
  }

  /**
   * Immediately halt any currently playing or queued audio (Barge-In)
   */
  public interruptPlayback() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];
    this.isSpeaking = false;
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
  }

  /**
   * Send text message directly into current Live session
   */
  public sendTextMessage(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.interruptPlayback();

    const clientMsg = {
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text }],
          },
        ],
        turnComplete: true,
      },
    };

    this.ws.send(JSON.stringify(clientMsg));
    this.callbacks.onTranscriptChunk?.(text, false);
    this.callbacks.onStatusChange?.("speaking");
  }

  /**
   * Set mute state
   */
  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Update voice persona preset
   */
  public updateVoice(voiceName: string) {
    this.config.voiceName = voiceName;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendInitialHandshake();
    }
  }

  /**
   * Volume Telemetry loop for orb visualization
   */
  private startTelemetryLoop() {
    const update = () => {
      let micVol = 0;
      let speakerVol = 0;

      if (this.micAnalyser && !this.isMuted) {
        const data = new Uint8Array(this.micAnalyser.frequencyBinCount);
        this.micAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        micVol = Math.min(1, sum / (data.length * 128));
      }

      if (this.speakerAnalyser && this.isSpeaking) {
        const data = new Uint8Array(this.speakerAnalyser.frequencyBinCount);
        this.speakerAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        speakerVol = Math.min(1, sum / (data.length * 128));
      }

      this.callbacks.onVolumeChange?.(micVol, speakerVol);

      if (!this.isClosed) {
        this.animFrameId = requestAnimationFrame(update);
      }
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  /**
   * Helpers for PCM conversion and Base64 encoding
   */
  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const output = new DataView(new ArrayBuffer(input.length * 2));
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return output.buffer;
  }

  private pcm16ToFloat32(buffer: ArrayBuffer): Float32Array {
    const view = new DataView(buffer);
    const length = buffer.byteLength / 2;
    const float32 = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const int16 = view.getInt16(i * 2, true);
      float32[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
    }
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Close and cleanup all audio contexts, streams, and WebSocket
   */
  public close() {
    this.isClosed = true;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.interruptPlayback();

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.micProcessor) {
      try {
        this.micProcessor.disconnect();
      } catch {}
      this.micProcessor = null;
    }

    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }

    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch {}
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.callbacks.onStatusChange?.("closed");
  }
}
