import request from 'supertest';
import express from 'express';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { pool } from '../src/db';
import { authRoutes } from '../src/routes/auth';

const mockPoolQuery = pool.query as jest.MockedFunction<any>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        role: 'student'
      };

      mockBcrypt.hash.mockResolvedValue('hashedPassword' as never);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 1, email: userData.email, name: userData.name, role: userData.role }]
      } as never);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(mockBcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
    });

    test('should return 400 for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    test('should return 400 for missing required fields', async () => {
      const userData = {
        email: 'test@example.com'
        // missing password and name
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        id: '1',
        email: loginData.email,
        password: 'hashedPassword',
        name: 'Test User',
        role: 'student'
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockUser]
      } as never);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJwt.sign.mockReturnValue('mockToken' as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(loginData.email);
    });

    test('should return 401 for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: []
      } as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    test('should return 401 for wrong password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const mockUser = {
        id: '1',
        email: loginData.email,
        password: 'hashedPassword',
        name: 'Test User',
        role: 'student'
      };

      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockUser]
      } as never);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    test('should return current user with valid token', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'student'
      };

      mockJwt.verify.mockReturnValue({ userId: '1' } as never);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockUser]
      } as never);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer validToken')
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(mockUser.email);
    });

    test('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Unauthorized');
    });

    test('should return 401 with invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidToken')
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Invalid token');
    });
  });
});
