import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isSoundMuted,
  toggleSoundMute,
  playTaskCompletedSound,
  playTaskStartedSound,
  playWarningSound,
  playClickSound,
} from "../sound-effects";

describe("Web Audio Sound Effects Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports all audio cues and mute toggles", () => {
    expect(typeof isSoundMuted).toBe("function");
    expect(typeof toggleSoundMute).toBe("function");
    expect(typeof playTaskCompletedSound).toBe("function");
    expect(typeof playTaskStartedSound).toBe("function");
    expect(typeof playWarningSound).toBe("function");
    expect(typeof playClickSound).toBe("function");
  });

  it("handles sound mute toggle gracefully", () => {
    const initial = isSoundMuted();
    const toggled = toggleSoundMute();
    expect(toggled).toBe(!initial);
    // Toggle back
    const restored = toggleSoundMute();
    expect(restored).toBe(initial);
  });

  it("executes sound triggers safely without throwing in node environment", () => {
    expect(() => playTaskCompletedSound()).not.toThrow();
    expect(() => playTaskStartedSound()).not.toThrow();
    expect(() => playWarningSound()).not.toThrow();
    expect(() => playClickSound()).not.toThrow();
  });
});
