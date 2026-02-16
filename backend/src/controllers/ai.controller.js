// backend/src/controllers/ai.controller.js
import { broadcast } from "../websocket.js";
import pool from "../models/db.js";

export const receiveAlert = async (req, res) => {
  const { user_id, cheating_score, flags } = req.body;

  await pool.query(
    "INSERT INTO ai_flags(user_id,score,flags) VALUES($1,$2,$3)",
    [user_id, cheating_score, JSON.stringify(flags)]
  );

  broadcast({
    user_id,
    cheating_score,
    flags,
    at: new Date().toISOString(),
  });

  res.json({ status: "received" });
};
