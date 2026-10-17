import { fleetEventBus, FleetEvent } from "@/lib/event-bus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send recent events immediately upon connection
      const recent = fleetEventBus.getRecent();
      for (const evt of recent.reverse()) {
        const payload = `data: ${JSON.stringify(evt)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // 2. Listener for live published events
      const onEvent = (event: FleetEvent) => {
        try {
          const payload = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream might be closed by client
        }
      };

      fleetEventBus.on("fleet_event", onEvent);

      // 3. Keep-alive heartbeat ping every 20 seconds
      const heartbeatInterval = setInterval(() => {
        try {
          const pingPayload = `data: ${JSON.stringify({
            id: `ping-${Date.now()}`,
            type: "ping",
            data: {},
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(encoder.encode(pingPayload));
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 20000);

      // 4. Cleanup when client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        fleetEventBus.off("fleet_event", onEvent);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
