export interface CUATelemetryEvent {
  id: string;
  action:
    | "move"
    | "click"
    | "double_click"
    | "right_click"
    | "drag"
    | "type"
    | "key"
    | "hotkey"
    | "launch"
    | "inspect"
    | "step";
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  text?: string;
  key?: string;
  combo?: string;
  stepTitle?: string;
  source: "agent" | "human";
  timestamp: number;
}

// Global in-memory ring buffer (persists across hot reloads in Next.js development)
const globalTelemetry = globalThis as unknown as {
  __cua_telemetry_events?: CUATelemetryEvent[];
  __cua_agent_cursor?: { x: number; y: number; updated: number };
};

if (!globalTelemetry.__cua_telemetry_events) {
  globalTelemetry.__cua_telemetry_events = [];
}
if (!globalTelemetry.__cua_agent_cursor) {
  globalTelemetry.__cua_agent_cursor = { x: 960, y: 540, updated: Date.now() };
}

/**
 * Record a new telemetry event from the Agent Desktop Operator
 */
export function recordCUATelemetry(
  event: Omit<CUATelemetryEvent, "id" | "timestamp"> & { timestamp?: number }
): CUATelemetryEvent {
  const fullEvent: CUATelemetryEvent = {
    id: `tel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: event.timestamp || Date.now(),
    ...event,
  };

  if (typeof fullEvent.x === "number" && typeof fullEvent.y === "number") {
    globalTelemetry.__cua_agent_cursor = {
      x: fullEvent.x,
      y: fullEvent.y,
      updated: fullEvent.timestamp,
    };
  }

  const list = globalTelemetry.__cua_telemetry_events!;
  list.push(fullEvent);
  if (list.length > 100) {
    list.splice(0, list.length - 100);
  }

  return fullEvent;
}

/**
 * Retrieve recent telemetry events since a specific timestamp
 */
export function getCUATelemetry(since = 0): {
  events: CUATelemetryEvent[];
  cursor: { x: number; y: number; updated: number };
  latestStep?: string;
} {
  const all = globalTelemetry.__cua_telemetry_events || [];
  const events = since > 0 ? all.filter((e) => e.timestamp > since) : all.slice(-25);
  const cursor = globalTelemetry.__cua_agent_cursor || { x: 960, y: 540, updated: Date.now() };

  // Find latest step description if available
  const latestStepEvent = [...all].reverse().find((e) => e.stepTitle);
  const latestStep = latestStepEvent?.stepTitle;

  return { events, cursor, latestStep };
}

/**
 * Clear telemetry history
 */
export function clearCUATelemetry(): void {
  globalTelemetry.__cua_telemetry_events = [];
}
