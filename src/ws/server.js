import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../config/arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
  }
}

export default function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024, // 1MB
  });
  wss.on("connection", async (socket, req) => {
    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Rate Limit Exceeded"
            : "Access isDenied";

          socket.close(code, reason);

          return;
        }
      } catch (error) {
        console.log("WS Error Connection");
        socket.close(1011, "Server Security Error");
      }
    }

    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    sendJson(socket, { type: "Welcome world" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.isAlive === false) return client.terminate();
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));
  function broadcastMatchCreated(match) {
    broadcast(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
