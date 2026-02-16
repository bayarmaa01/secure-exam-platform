import pool from "../models/db.js";
import { hashPassword, comparePassword } from "../utils/hash.js";
import { generateToken } from "../services/token.service.js";
import { v4 as uuid } from "uuid";

export const register = async (req, res) => {
  const { email, password } = req.body;
  const hashed = await hashPassword(password);

  const user = await pool.query(
    "INSERT INTO users(id,email,password,role) VALUES($1,$2,$3,'STUDENT') RETURNING id,email,role",
    [uuid(), email, hashed]
  );

  res.json(user.rows[0]);
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  if (!result.rows.length)
    return res.status(401).json({ message: "Invalid credentials" });

  const user = result.rows[0];
  const valid = await comparePassword(password, user.password);
  if (!valid) return res.status(401).json({ message: "Invalid credentials" });

  res.json({ token: generateToken(user) });
};
