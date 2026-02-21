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
    path: "/ws",
    maxPayload: 1024 * 1024, // 1MB
    noServer: true,
  });

  // Handle WebSocket upgrade with Arcjet protection at pre-handshake stage
  server.on("upgrade", async (req, socket, head) => {
    try {
      if (wsArcjet) {
        const decision = await wsArcjet.protect(req);
        if (decision.isDenied()) {
          const statusCode = decision.reason.isRateLimit() ? 429 : 403;
          const reason = decision.reason.isRateLimit()
            ? "Rate Limit Exceeded"
            : "Access Denied";

          // Write HTTP error response before WebSocket handshake
          socket.write(
            `HTTP/1.1 ${statusCode} ${reason}\r\n` +
            "Connection: close\r\n" +
            "Content-Length: 0\r\n" +
            "\r\n"
          );
          socket.destroy();
          return;
        }
      }

      // On success, complete the WebSocket handshake
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch (error) {
      console.error("WS Upgrade Error:", error);
      socket.write(
        "HTTP/1.1 500 Internal Server Error\r\n" +
        "Connection: close\r\n" +
        "Content-Length: 0\r\n" +
        "\r\n"
      );
      socket.destroy();
    }
  });

  wss.on("connection", (socket, req) => {
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
