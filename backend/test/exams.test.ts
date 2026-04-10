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
  auth: jest.fn((req: any, res: any, next: any) => {
    req.user = { id: '1', email: 'test@example.com', role: 'teacher', name: 'Test Teacher' };
    next();
  }),
  requireStudent: jest.fn((req: any, res: any, next: any) => next()),
  requireTeacher: jest.fn((req: any, res: any, next: any) => next()),
  requireAdmin: jest.fn((req: any, res: any, next: any) => next())
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

  describe('Basic CRUD Operations', () => {
    test('should get available exams', async () => {
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

    test('should get exam by id', async () => {
      const mockExam = {
        id: 1,
        title: 'Math Exam',
        description: 'Basic mathematics',
        duration_minutes: 60,
        total_marks: 100,
        teacher_id: '1', // Match the mock user ID
        status: 'published',
        start_time: new Date().toISOString(),
        created_at: new Date().toISOString(),
        teacher_name: 'Test Teacher'
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockExam]
      } as never);

      const response = await request(app)
        .get('/api/exams/1')
        .expect(200);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('title', 'Math Exam');
      expect(response.body).toHaveProperty('teacherName', 'Test Teacher');
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

    test('should update an exam', async () => {
      const updateData = {
        title: 'Updated Exam Title',
        description: 'Updated description'
      };

      // Mock ownership check
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ teacher_id: '1' }] // Match the mock user ID
      } as never);

      // Mock update result
      const mockUpdatedExam = {
        id: 1,
        title: updateData.title,
        description: updateData.description,
        duration_minutes: 60,
        teacher_id: '1'
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

  describe('Validation and Error Handling', () => {
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

    test('should handle database errors gracefully', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('Database error') as never);

      const response = await request(app)
        .get('/api/exams')
        .expect(500);

      expect(response.body).toHaveProperty('message', 'Internal server error');
    });
  });

  describe('Question Management', () => {
    test('should get exam questions', async () => {
      // Mock exam access check
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ teacher_id: '1', status: 'published' }] // Match the mock user ID and status
      } as never);

      const mockQuestions = [
        {
          id: 1,
          question_text: 'What is 2+2?',
          type: 'multiple_choice',
          options: ['3', '4', '5', '6'],
          points: 10
        }
      ];

      mockPoolQuery.mockResolvedValueOnce({
        rows: mockQuestions
      } as never);

      const response = await request(app)
        .get('/api/exams/1/questions')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].text).toBe('What is 2+2?');
    });
  });

  describe('Teacher-specific Routes', () => {
    test('should get teacher exams', async () => {
      const mockTeacherExams = [
        {
          id: 1,
          title: 'Teacher Exam',
          description: 'Created by teacher',
          duration_minutes: 90,
          start_time: new Date().toISOString(),
          status: 'draft',
          created_at: new Date().toISOString()
        }
      ];

      mockPoolQuery.mockResolvedValueOnce({
        rows: mockTeacherExams
      } as never);

      const response = await request(app)
        .get('/api/teacher/exams')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Teacher Exam');
    });

    test('should get teacher results', async () => {
      const mockResults = [
        {
          id: 1,
          score: 85,
          total_points: 100,
          percentage: 85,
          status: 'completed',
          student_name: 'John Doe',
          exam_title: 'Math Exam',
          created_at: new Date().toISOString()
        }
      ];

      mockPoolQuery.mockResolvedValueOnce({
        rows: mockResults
      } as never);

      const response = await request(app)
        .get('/api/teacher/results')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].score).toBe(85);
    });
  });

  describe('Admin Routes', () => {
    test('should get all exams (admin)', async () => {
      const mockAllExams = [
        {
          id: 1,
          title: 'Admin View Exam',
          description: 'All exams for admin',
          duration_minutes: 60,
          teacher_name: 'Teacher Name',
          status: 'published'
        }
      ];

      mockPoolQuery.mockResolvedValueOnce({
        rows: mockAllExams
      } as never);

      const response = await request(app)
        .get('/api/admin/exams')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Admin View Exam');
    });
  });
});
