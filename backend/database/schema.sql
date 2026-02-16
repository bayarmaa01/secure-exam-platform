CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT CHECK (role IN ('ADMIN','STUDENT')) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE exams (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  duration INT NOT NULL,
  created_by UUID REFERENCES users(id)
);

CREATE TABLE exam_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  exam_id UUID REFERENCES exams(id),
  answers JSONB,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_flags (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  score FLOAT,
  flags JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
