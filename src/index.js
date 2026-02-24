import express from "express";
import { matchRouter } from "./routes/matches.js";
import http from "node:http";
import attachWebSocketServer from "./ws/server.js";
import { securityMiddleware } from "./config/arcjet.js";
import { commentaryRouter } from "./routes/commentary.js";

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

app.use(securityMiddleware());

app.use("/matches", matchRouter);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchCreated,broadcastCommentry } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentry = broadcastCommentry;

server.listen(PORT, HOST, () => {
  const baseURL =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server started at ${baseURL}`);
  console.log(
    `WebSocket server running at ${baseURL.replace("http", "ws")}/ws`,
  );
});
