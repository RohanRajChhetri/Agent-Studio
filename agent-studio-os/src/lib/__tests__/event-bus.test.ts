import { describe, it, expect, vi } from "vitest";
import { fleetEventBus } from "@/lib/event-bus";

describe("Fleet Event Bus (SSE)", () => {
  it("publishes events and notifies subscribers", () => {
    const listener = vi.fn();
    fleetEventBus.on("fleet_event", listener);

    const event = fleetEventBus.publish("task_updated", { taskId: "task-123" });

    expect(event.id).toBeDefined();
    expect(event.type).toBe("task_updated");
    expect(event.data.taskId).toBe("task-123");
    expect(listener).toHaveBeenCalledWith(event);

    fleetEventBus.off("fleet_event", listener);
  });

  it("stores recent events up to maximum buffer size", () => {
    for (let i = 0; i < 5; i++) {
      fleetEventBus.publish("ping", { index: i });
    }
    const recent = fleetEventBus.getRecent();
    expect(Array.isArray(recent)).toBe(true);
    expect(recent.length).toBeGreaterThanOrEqual(5);
  });
});
