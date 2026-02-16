import pool from "../models/db.js";
import { v4 as uuid } from "uuid";

export const listExams = async (_, res) => {
  const exams = await pool.query("SELECT * FROM exams");
  res.json(exams.rows);
};

export const submitExam = async (req, res) => {
  const { examId, answers } = req.body;

  await pool.query(
    "INSERT INTO exam_sessions(id,user_id,exam_id,answers) VALUES($1,$2,$3,$4)",
    [uuid(), req.user.id, examId, JSON.stringify(answers)]
  );

  res.json({ message: "Exam submitted" });
};
export const createExam = async (req, res) => {
  const { title, duration } = req.body;

  const exam = await pool.query(
    "INSERT INTO exams(id,title,duration,created_by) VALUES($1,$2,$3,$4) RETURNING *",
    [uuid(), title, duration, req.user.id]
  );

  res.status(201).json(exam.rows[0]);
};
