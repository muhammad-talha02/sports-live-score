import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../config/arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }

  matchSubscribers.get(matchId).add(socket);
}

function unSubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;
  subscribers.delete(socket);
  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptons(socket) {
  for (const matchId of socket?.subscribers) {
    unSubscribe(matchId, socket);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(JSON.stringify(payload));
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);
  console.log({ subscribers:subscribers.clients });

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function handleMessage(socket, data) {
  let message;
  console.log({ data: data.toString() });
  try {
    message = JSON.parse(data.toString());
    console.log({ message });
  } catch (error) {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
  }

  if (message?.type === "subscribe" && Number.isInteger(message.matchId)) {
    subscribe(message.matchId, socket);
    socket?.subscriptions.add(message.matchId);

    sendJson(socket, { type: "subscribed", matchId: message.matchId });

    return;
  }

  if (message?.type === "unsubscribe" && Number.isInteger(message.matchId)) {
    unSubscribe(message.matchId, socket);
    socket.subscriptions.delete(message.matchId);
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
              "\r\n",
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
          "\r\n",
      );
      socket.destroy();
    }
  });

  wss.on("connection", (socket, req) => {
    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.subscriptions = new Set();
    sendJson(socket, { type: "Welcome world" });

    socket.on("message", (data) => {
      handleMessage(socket, data);
    });

    socket.on("error", (data) => {
      socket.terminate();
    });

    socket.on("close", (data) => {
      cleanupSubscriptons(socket);
    });

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
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentry(matchId, comment) {
    broadcastToMatch(matchId, { type: "comment", message: comment });
  }

  return { broadcastMatchCreated, broadcastCommentry };
}
