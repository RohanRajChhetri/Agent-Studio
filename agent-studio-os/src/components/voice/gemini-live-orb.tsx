"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Radio,
  Sparkles,
  Bot,
  RefreshCw,
  AlertCircle,
  Sliders,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Send,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
}

interface GeminiLiveOrbProps {
  isOpen: boolean;
  onClose: () => void;
  initialAgentId?: string;
}

export function GeminiLiveOrb({ isOpen, onClose, initialAgentId }: GeminiLiveOrbProps) {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(initialAgentId || "");
  const [voiceConfig, setVoiceConfig] = useState<any>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>("Puck");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "fallback_ready" | "error">("connecting");
  const [engineMode, setEngineMode] = useState<"websocket" | "speech_api">("speech_api");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<Array<{ sender: "user" | "agent"; text: string; time: string }>>([]);
  const [currentSpeech, setCurrentSpeech] = useState<string>("");
  const [textInput, setTextInput] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript ticker
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcripts, currentSpeech]);

  // Fetch agents list
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.agents || [];
        setAgents(list);
        if (!selectedAgentId && list.length > 0) {
          setSelectedAgentId(list[0].id);
        }
      })
      .catch(() => {});
  }, [isOpen, selectedAgentId]);

  // Load Voice Configuration & Setup Audio Engine
  const initVoiceEngine = useCallback(async () => {
    try {
      setConnectionStatus("connecting");
      const res = await fetch(`/api/voice/gemini-live${selectedAgentId ? `?agentId=${selectedAgentId}` : ""}`);
      const data = await res.json();
      setVoiceConfig(data);

      if (data.defaultVoice) {
        setSelectedVoice(data.defaultVoice);
      }

      // Check if direct Gemini Live WebSocket is usable
      if (data.liveEndpoint && data.apiKey && data.apiKey.startsWith("AIzaSy")) {
        try {
          const ws = new WebSocket(data.liveEndpoint);
          socketRef.current = ws;

          ws.onopen = () => {
            setEngineMode("websocket");
            setConnectionStatus("connected");
            toast.success("Connected to Gemini 2.0 Live WebSocket stream");
          };

          ws.onerror = () => {
            // Graceful fallback to speech API
            setEngineMode("speech_api");
            setConnectionStatus("fallback_ready");
          };

          ws.onclose = () => {
            setEngineMode("speech_api");
            setConnectionStatus("fallback_ready");
          };
        } catch {
          setEngineMode("speech_api");
          setConnectionStatus("fallback_ready");
        }
      } else {
        // Active resilient mode
        setEngineMode("speech_api");
        setConnectionStatus("fallback_ready");
      }
    } catch (err: any) {
      setConnectionStatus("error");
      toast.error("Failed to initialize voice engine: " + err.message);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (isOpen) {
      initVoiceEngine();
    } else {
      stopAudioCapture();
    }
  }, [isOpen, initVoiceEngine]);

  // Visualizer loop for real-time waveform aura
  const startVolumeTracking = useCallback((stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setVolumeLevel(Math.min(1, avg / 80));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch {
      // Audio visualizer fallback
    }
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsListening(false);
    setIsSpeaking(false);
    setVolumeLevel(0);
  }, []);

  // Text-to-speech speaker
  const speakAgentResponse = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = selectedVoice === "Charon" ? 0.8 : selectedVoice === "Aoede" ? 1.15 : 1.0;

      // Select system voice if available
      const sysVoices = window.speechSynthesis.getVoices();
      if (sysVoices.length > 0) {
        const found = sysVoices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (selectedVoice === "Aoede" || selectedVoice === "Kore"
              ? v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("samantha") || v.name.toLowerCase().includes("zira")
              : v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("daniel"))
        );
        if (found) utterance.voice = found;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current = window.speechSynthesis;
      window.speechSynthesis.speak(utterance);
    },
    [selectedVoice]
  );

  // Send turn to Voice Backend
  const handleSendUtterance = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setTranscripts((prev) => [...prev, { sender: "user", text, time }]);
      setCurrentSpeech("");

      try {
        setIsSpeaking(true);
        const res = await fetch("/api/voice/gemini-live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            agentId: selectedAgentId,
            voice: selectedVoice,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.text) {
          const respTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          setTranscripts((prev) => [
            ...prev,
            { sender: "agent", text: data.text, time: respTime },
          ]);
          speakAgentResponse(data.text);
        } else {
          toast.error(data.error || "Voice response failed");
          setIsSpeaking(false);
        }
      } catch (err: any) {
        toast.error("Audio communication error: " + err.message);
        setIsSpeaking(false);
      }
    },
    [selectedAgentId, selectedVoice, speakAgentResponse]
  );

  // Microphone toggle & speech recognition
  const toggleListening = useCallback(async () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      startVolumeTracking(stream);

      // Initialize Web Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const reco = new SpeechRecognition();
        reco.continuous = true;
        reco.interimResults = true;
        reco.lang = "en-US";

        reco.onresult = (event: any) => {
          let interim = "";
          let final = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          if (interim) {
            setCurrentSpeech(interim);
          }

          if (final.trim()) {
            handleSendUtterance(final.trim());
          }
        };

        reco.onerror = (e: any) => {
          console.warn("Speech recognition error:", e);
        };

        reco.onend = () => {
          if (isListening) {
            try {
              reco.start();
            } catch {}
          }
        };

        reco.start();
        recognitionRef.current = reco;
        setIsListening(true);
      } else {
        toast.info("Microphone visualizer active. Type or speak using your browser audio input.");
        setIsListening(true);
      }
    } catch (err: any) {
      toast.error("Could not access microphone: " + err.message);
    }
  }, [isListening, startVolumeTracking, handleSendUtterance]);

  if (!isOpen) return null;

  const currentAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative rounded-2xl border border-border bg-card text-foreground shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
            isMaximized
              ? "w-[96vw] h-[92vh] max-w-5xl"
              : "w-full max-w-xl h-[620px]"
          }`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <span className="text-xl">{currentAgent?.avatar || "🎙️"}</span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                    isSpeaking
                      ? "bg-emerald-500 animate-ping"
                      : isListening
                      ? "bg-primary animate-pulse"
                      : "bg-muted-foreground"
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {currentAgent?.displayName || "Gemini Live Voice Cockpit"}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono font-medium">
                    {engineMode === "websocket" ? "Gemini 2.0 Bidi" : "Active Neural Voice"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isSpeaking
                    ? "Agent is speaking..."
                    : isListening
                    ? "Listening for speech..."
                    : "Tap microphone to speak"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                title={isMaximized ? "Restore view" : "Maximize view"}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                title="Close Voice Cockpit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Central Interactive Voice Orb Aura */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-background via-secondary/10 to-background">
            {/* Pulsing Concentric Sound Waves */}
            <div className="relative flex items-center justify-center w-64 h-64">
              {/* Outer Glow Halo */}
              <motion.div
                animate={{
                  scale: isSpeaking ? [1, 1.35, 1.15, 1.4, 1] : isListening ? 1 + volumeLevel * 0.8 : 1,
                  opacity: isSpeaking ? 0.35 : isListening ? 0.2 + volumeLevel * 0.5 : 0.1,
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#0075de] via-purple-500 to-emerald-400 blur-2xl"
              />

              {/* Medium Wave Ring */}
              <motion.div
                animate={{
                  scale: isSpeaking ? [1, 1.22, 1] : 1 + volumeLevel * 0.5,
                  rotate: isSpeaking ? 360 : 0,
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute w-52 h-52 rounded-full border border-primary/30 border-dashed"
              />

              {/* Inner Glowing Orb Sphere */}
              <motion.div
                animate={{
                  scale: isSpeaking ? [1, 1.12, 0.98, 1.08, 1] : 1 + volumeLevel * 0.35,
                }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                onClick={toggleListening}
                className={`relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-xl cursor-pointer transition-all duration-300 border ${
                  isSpeaking
                    ? "bg-gradient-to-br from-emerald-500/20 via-purple-600/30 to-[#0075de]/30 border-emerald-400/50 shadow-emerald-500/20"
                    : isListening
                    ? "bg-gradient-to-br from-[#0075de]/30 via-purple-500/20 to-sky-400/20 border-primary shadow-primary/30"
                    : "bg-secondary/80 hover:bg-secondary border-border"
                }`}
              >
                <div className="text-3xl mb-1">
                  {currentAgent?.avatar || "🤖"}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground/90">
                  {isListening ? (
                    <span className="text-primary font-bold">Listening</span>
                  ) : isSpeaking ? (
                    <span className="text-emerald-500 font-bold">Speaking</span>
                  ) : (
                    <span>Tap to Talk</span>
                  )}
                </div>
                {isListening && (
                  <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                    Audio Active
                  </span>
                )}
              </motion.div>
            </div>

            {/* Current Speech Interim Display */}
            {currentSpeech && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 px-3 py-1.5 rounded-full bg-secondary/80 border border-primary/30 text-xs text-foreground/90 max-w-md text-center truncate italic shadow-xs"
              >
                &ldquo;{currentSpeech}&rdquo;
              </motion.div>
            )}
          </div>

          {/* Transcript Ticker View */}
          <div
            ref={transcriptScrollRef}
            className="h-32 px-5 py-3 border-t border-border bg-secondary/20 overflow-y-auto space-y-2 text-xs"
          >
            {transcripts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-center">
                <span>Conversation transcript will appear here in real time...</span>
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${t.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-1.5 leading-relaxed ${
                      t.sender === "user"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-card border border-border text-foreground shadow-2xs"
                    }`}
                  >
                    {t.text}
                  </div>
                  <span className="text-[9.5px] text-muted-foreground mt-0.5 px-1 font-mono">
                    {t.time}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Bottom Controls & Persona Selector */}
          <div className="p-3.5 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {/* Left: Agent & Voice Selectors */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-secondary text-xs text-foreground focus:outline-none focus:border-primary font-medium"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.avatar} {a.displayName || a.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-secondary text-xs text-foreground focus:outline-none focus:border-primary font-medium"
              >
                <option value="Puck">Voice: Puck (Energetic)</option>
                <option value="Aoede">Voice: Aoede (Warm)</option>
                <option value="Charon">Voice: Charon (Deep)</option>
                <option value="Fenrir">Voice: Fenrir (Crisp)</option>
                <option value="Kore">Voice: Kore (Smooth)</option>
              </select>
            </div>

            {/* Right: Quick Text Input & Mic Trigger */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (textInput.trim()) {
                  handleSendUtterance(textInput.trim());
                  setTextInput("");
                }
              }}
              className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-sm justify-end"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Or type a message to speak..."
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />

              <button
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border transition disabled:opacity-40 cursor-pointer"
                title="Send text to speak"
              >
                <Send className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 ${
                  isListening
                    ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                }`}
                title={isListening ? "Stop listening" : "Start speaking"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
