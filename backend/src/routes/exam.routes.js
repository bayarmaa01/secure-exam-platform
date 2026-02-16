export const createExam = async (req, res) => {
  const { title, duration } = req.body;

  const exam = await pool.query(
    "INSERT INTO exams(id,title,duration,created_by) VALUES($1,$2,$3,$4) RETURNING *",
    [uuid(), title, duration, req.user.id]
  );

  res.status(201).json(exam.rows[0]);
};
