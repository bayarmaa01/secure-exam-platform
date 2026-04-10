import request from 'supertest';
import express from 'express';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

jest.mock('../src/middleware/auth', () => ({
  auth: (req: any, res: any, next: any) => {
    req.user = { id: 1, email: 'test@example.com', role: 'student' };
    next();
  },
  requireStudent: (req: any, res: any, next: any) => next(),
  requireTeacher: (req: any, res: any, next: any) => next(),
  requireAdmin: (req: any, res: any, next: any) => next()
}));

import { pool } from '../src/db';
import { examRoutes } from '../src/routes/exams';

const mockPoolQuery = pool.query as jest.MockedFunction<typeof pool.query>;

const app = express();
app.use(express.json());
app.use('/api', examRoutes);

describe('Exam Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/exams', () => {
    test('should get available exams for students', async () => {
      const mockExams = [
        {
          id: 1,
          title: 'Math Exam',
          description: 'Basic mathematics',
          duration_minutes: 60,
          start_time: new Date().toISOString(),
          status: 'published'
        }
      ];

      mockPoolQuery.mockResolvedValueOnce({
        rows: mockExams
      } as never);

      const response = await request(app)
        .get('/api/exams')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Math Exam');
      expect(response.body[0].durationMinutes).toBe(60);
    });

    test('should handle database errors', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('Database error') as never);

      const response = await request(app)
        .get('/api/exams')
        .expect(500);

      expect(response.body).toHaveProperty('message', 'Internal server error');
    });
  });

  describe('GET /api/exams/:id', () => {
    test('should get exam by id', async () => {
      const mockExam = {
        id: 1,
        title: 'Math Exam',
        description: 'Basic mathematics',
        duration_minutes: 60,
        total_marks: 100,
        teacher_name: 'John Doe'
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockExam]
      } as never);

      const response = await request(app)
        .get('/api/exams/1')
        .expect(200);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('title', 'Math Exam');
      expect(response.body).toHaveProperty('teacherName', 'John Doe');
    });

    test('should return 404 for non-existent exam', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: []
      } as never);

      const response = await request(app)
        .get('/api/exams/999')
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Exam not found');
    });
  });

  describe('POST /api/exams', () => {
    test('should create a new exam', async () => {
      const examData = {
        title: 'New Exam',
        description: 'Test description',
        duration_minutes: 60,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 3600000).toISOString()
      };

      const mockCreatedExam = {
        id: 1,
        ...examData,
        teacher_id: 1,
        created_at: new Date().toISOString()
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockCreatedExam]
      } as never);

      const response = await request(app)
        .post('/api/exams')
        .send(examData)
        .expect(201);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('title', examData.title);
    });

    test('should return 400 for missing required fields', async () => {
      const incompleteData = {
        title: 'Incomplete Exam'
        // missing other required fields
      };

      const response = await request(app)
        .post('/api/exams')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('PUT /api/exams/:id', () => {
    test('should update an exam', async () => {
      const updateData = {
        title: 'Updated Exam Title',
        description: 'Updated description'
      };

      const mockUpdatedExam = {
        id: 1,
        title: updateData.title,
        description: updateData.description,
        duration_minutes: 60,
        teacher_id: 1
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockUpdatedExam]
      } as never);

      const response = await request(app)
        .put('/api/exams/1')
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('title', updateData.title);
      expect(response.body).toHaveProperty('description', updateData.description);
    });

    test('should return 404 when updating non-existent exam', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: []
      } as never);

      const response = await request(app)
        .put('/api/exams/999')
        .send({ title: 'Updated Title' })
        .expect(404);

      expect(response.body).toHaveProperty('message', 'Exam not found');
    });
  });

  describe('GET /api/exams/:id/questions', () => {
    test('should get exam questions', async () => {
      const mockQuestions = [
        {
          id: 1,
          question_text: 'What is 2+2?',
          question_type: 'multiple_choice',
          options: ['3', '4', '5', '6'],
          marks: 10
        }
      ];

      mockPoolQuery.mockResolvedValueOnce({
        rows: mockQuestions
      } as never);

      const response = await request(app)
        .get('/api/exams/1/questions')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].question_text).toBe('What is 2+2?');
    });
  });

  describe('POST /api/exams/:id/start', () => {
    test('should start exam attempt', async () => {
      const mockAttempt = {
        id: 'attempt-123',
        exam_id: 1,
        user_id: 1,
        started_at: new Date().toISOString()
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockAttempt]
      } as never);

      const response = await request(app)
        .post('/api/exams/1/start')
        .expect(200);

      expect(response.body).toHaveProperty('attemptId');
      expect(response.body).toHaveProperty('startTime');
    });
  });

  describe('POST /api/exams/attempts/:attemptId/submit', () => {
    test('should submit exam attempt', async () => {
      const submissionData = {
        answers: [
          {
            question_id: 1,
            answer: '4'
          }
        ]
      };

      const mockResult = {
        id: 1,
        exam_id: 1,
        user_id: 1,
        score: 10,
        total_points: 100,
        percentage: 10,
        status: 'submitted',
        created_at: new Date().toISOString()
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockResult]
      } as never);

      const response = await request(app)
        .post('/api/exams/attempts/attempt123/submit')
        .send(submissionData)
        .expect(200);

      expect(response.body).toHaveProperty('score', 10);
      expect(response.body).toHaveProperty('percentage', 10);
    });

    test('should return 400 for missing answers', async () => {
      const response = await request(app)
        .post('/api/exams/attempts/attempt123/submit')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });
});
