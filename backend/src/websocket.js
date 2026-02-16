import { WebSocketServer } from "ws";

export const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Admin connected");

  ws.on("message", (msg) => {
    console.log("Received:", msg.toString());
  });
});

export const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
};
