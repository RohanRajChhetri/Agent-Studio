import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ReasoningProgressIndicator,
  type ReasoningState,
} from "@/components/chat/reasoning-progress-indicator";

describe("ReasoningProgressIndicator Component", () => {
  it("renders live streaming state with elapsed time, iteration loop, and streaming badge", () => {
    const activeState: ReasoningState = {
      isStreaming: true,
      elapsedMs: 2400,
      iteration: 2,
      totalIterations: 3,
      phase: "streaming_tokens",
      phaseLabel: "Synthesizing streamed response",
      tokenCount: 142,
      tokensPerSec: 59,
      model: "auto/fast",
    };

    const html = renderToStaticMarkup(
      React.createElement(ReasoningProgressIndicator, { state: activeState })
    );

    expect(html).toContain("Reasoning Loop");
    expect(html).toContain("Iteration 2 / 3");
    expect(html).toContain("Synthesizing streamed response");
    expect(html).toContain("2.4s");
    expect(html).toContain("Streaming");
    expect(html).toContain("142 tok");
  });

  it("renders completed state with thought duration summary", () => {
    const completedState: ReasoningState = {
      isStreaming: false,
      elapsedMs: 3100,
      iteration: 3,
      totalIterations: 3,
      phase: "completed",
      phaseLabel: "Reasoning complete",
      tokenCount: 320,
      tokensPerSec: 103,
      model: "auto/fast",
    };

    const html = renderToStaticMarkup(
      React.createElement(ReasoningProgressIndicator, { state: completedState })
    );

    expect(html).toContain("Thought for 3.1s");
    expect(html).toContain("3 iterations");
    expect(html).toContain("320 tokens");
  });

  it("renders expanded thought trace if provided", () => {
    const thinkingState: ReasoningState = {
      isStreaming: true,
      elapsedMs: 1200,
      iteration: 1,
      totalIterations: 3,
      phase: "reasoning_loop",
      phaseLabel: "Analyzing query constraints",
      tokenCount: 45,
      thoughtText: "Step 1: Need to verify tournament records.",
      model: "auto/fast",
    };

    const html = renderToStaticMarkup(
      React.createElement(ReasoningProgressIndicator, {
        state: thinkingState,
        defaultExpanded: true,
      })
    );

    expect(html).toContain("Model Internal Thought Stream");
    expect(html).toContain("Step 1: Need to verify tournament records.");
    expect(html).toContain("Iteration 1 / 3");
  });
});
