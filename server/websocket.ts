import { WebSocketServer, WebSocket } from "ws";
import { type Server } from "http";

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: Server) {
  // Use a specific path to avoid conflicts with Vite's WebSocket
  wss = new WebSocketServer({ 
    server,
    path: "/ws/locks"
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WebSocket] Lock client connected");

    ws.on("close", () => {
      console.log("[WebSocket] Lock client disconnected");
    });

    ws.on("error", (error) => {
      console.error("[WebSocket] Lock client error:", error);
    });

    ws.send(JSON.stringify({ type: "connected", message: "Lock WebSocket connection established" }));
  });

  console.log("[WebSocket] Lock broadcast server initialized on /ws/locks");
}

export function broadcastLockEvent(type: string, data: any) {
  if (!wss) {
    console.warn("[WebSocket] Broadcast attempted but WebSocket server not initialized");
    return;
  }

  const message = JSON.stringify({ type, data });

  try {
    let sentCount = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          console.error("[WebSocket] Error sending to client:", error);
        }
      }
    });

    if (sentCount > 0) {
      console.log(`[WebSocket] Broadcast ${type} to ${sentCount} client(s)`);
    }
  } catch (error) {
    console.error("[WebSocket] Error broadcasting lock event:", error);
  }
}
