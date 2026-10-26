/**
 * Web Audio Synthesizer & Ambient Sound Effects Engine
 * Uses the native browser AudioContext to synthesize modern micro-haptic audio cues.
 * Zero external mp3/wav files required, 0ms network latency, runs 100% offline.
 */

let audioCtx: AudioContext | null = null;
let soundMuted = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/** Check if audio is muted */
export function isSoundMuted(): boolean {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("agent_os_sound_muted");
    if (saved !== null) return saved === "true";
  }
  return soundMuted;
}

/** Toggle sound mute state */
export function toggleSoundMute(): boolean {
  soundMuted = !isSoundMuted();
  if (typeof window !== "undefined") {
    localStorage.setItem("agent_os_sound_muted", String(soundMuted));
    window.dispatchEvent(new CustomEvent("sound-mute-toggled", { detail: soundMuted }));
  }
  return soundMuted;
}

/**
 * Play a delicate harmonic success chime (e.g. on task deliverable completion)
 */
export function playTaskCompletedSound(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Two-tone rising harmonic arpeggio (C6 -> G6)
  const notes = [1046.5, 1567.98];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + idx * 0.12);

    gain.gain.setValueAtTime(0.001, now + idx * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.12);
    osc.stop(now + idx * 0.12 + 0.36);
  });
}

/**
 * Play an ambient futuristic pulse (e.g. on agent starting execution)
 */
export function playTaskStartedSound(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(580, now + 0.18);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.23);
}

/**
 * Play a gentle low warning tone (e.g. security guardrail blocked)
 */
export function playWarningSound(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.linearRampToValueAtTime(170, now + 0.2);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.26);
}

/**
 * Play a subtle tactile micro-click (e.g. command palette, toggle)
 */
export function playClickSound(): void {
  if (isSoundMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(800, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}
