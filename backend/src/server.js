import app from "./app.js";
import "./websocket.js"; // 👈 WebSocket server auto-start

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
});
