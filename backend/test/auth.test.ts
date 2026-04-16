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

// Mock the auth middleware
const mockAuth = jest.fn((req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  // If no token, return 401
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const token = authHeader.slice(7);
  
  // Handle different token scenarios
  if (token === 'invalidToken') {
    return res.status(401).json({ message: 'Invalid token' });
  }
  
  if (token === 'validToken') {
    // Mock the user object that would be set by the auth middleware
    req.user = { 
      id: '1', 
      email: 'test@example.com', 
      role: 'student',
      name: 'Test User'
    };
    next();
  } else {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

jest.mock('../src/middleware/auth', () => ({
  auth: mockAuth
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
        password: 'Password123!',
        name: 'Test User',
        role: 'student',
        registration_number: 'REG2026001'
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
        password: 'Password123!'
      };

      const mockUser = {
        id: 1,
        email: loginData.email,
        password_hash: 'hashedPassword',
        name: 'Test User',
        role: 'student'
      };

      // Mock the user query
      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockUser]
      } as never);
      
      // Mock password comparison to return true
      mockBcrypt.compare.mockResolvedValue(true as never);
      
      // Mock JWT signing for both access and refresh tokens
      mockJwt.sign.mockReturnValue('mockToken' as never);
      
      // Mock the refresh token insertion
      mockPoolQuery.mockResolvedValueOnce({
        rows: []
      } as never);

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
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      };

      // Clear all previous mocks
      jest.clearAllMocks();
      
      // Mock the user query to return empty rows (user not found)
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
        role: 'student',
        student_id: null,
        teacher_id: null
      };

      // Mock JWT verification to return the user ID
      mockJwt.verify.mockReturnValue({ userId: '1' } as never);
      
      // Mock the database query to return the user
      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockUser]
      } as never);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer validToken')
        .expect(200);

      expect(response.body).toHaveProperty('id', '1');
      expect(response.body).toHaveProperty('email', mockUser.email);
      expect(response.body).toHaveProperty('name', mockUser.name);
      expect(response.body).toHaveProperty('role', mockUser.role);
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
