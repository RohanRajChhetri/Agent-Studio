import { EventEmitter } from "events";

export interface FleetEvent {
  id: string;
  type: "task_updated" | "routine_executed" | "agent_status" | "vault_synced" | "ping";
  data: Record<string, any>;
  timestamp: string;
}

class FleetEventBus extends EventEmitter {
  private recentEvents: FleetEvent[] = [];
  private readonly maxRecent = 30;

  constructor() {
    super();
    // Support multiple concurrent listeners for SSE streams
    this.setMaxListeners(100);
  }

  public publish(type: FleetEvent["type"], data: Record<string, any> = {}): FleetEvent {
    const event: FleetEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > this.maxRecent) {
      this.recentEvents.pop();
    }

    this.emit("fleet_event", event);
    return event;
  }

  public getRecent(): FleetEvent[] {
    return [...this.recentEvents];
  }

  public getSubscriberCount(): number {
    return this.listenerCount("fleet_event");
  }
}

// Global singleton instance across Next.js API invocations
const globalForEventBus = globalThis as unknown as { fleetEventBus?: FleetEventBus };
export const fleetEventBus = globalForEventBus.fleetEventBus || new FleetEventBus();

if (process.env.NODE_ENV !== "production") {
  globalForEventBus.fleetEventBus = fleetEventBus;
}
