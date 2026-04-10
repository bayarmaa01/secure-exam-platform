import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { auth, requireStudent, requireTeacher, requireAdmin, AuthRequest } from '../src/middleware/auth';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn()
  }
}));

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const { pool } = require('../src/db');
const mockPoolQuery = pool.query as jest.MockedFunction<any>;

describe('Authentication Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    nextFunction = jest.fn();
  });

  describe('auth middleware', () => {
    test('should pass with valid token', async () => {
      const mockPayload = {
        userId: '1',
        email: 'test@example.com',
        role: 'student'
      };

      const mockUser = {
        id: '1',
        email: 'test@example.com',
        role: 'student',
        name: 'Test User'
      };

      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      mockJwt.verify.mockReturnValue(mockPayload as never);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [mockUser]
      } as never);

      await auth(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        id: '1',
        email: 'test@example.com',
        role: 'student',
        name: 'Test User'
      });
    });

    test('should return 401 without token', async () => {
      await auth(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('should return 401 with invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await auth(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Invalid token' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireStudent middleware', () => {
    test('should pass for student role', () => {
      mockRequest.user = {
        id: '1',
        email: 'student@example.com',
        role: 'student',
        name: 'Student'
      };

      requireStudent(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should return 403 for non-student role', () => {
      mockRequest.user = {
        id: '2',
        email: 'teacher@example.com',
        role: 'teacher',
        name: 'Teacher'
      };

      requireStudent(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Student access required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireTeacher middleware', () => {
    test('should pass for teacher role', () => {
      mockRequest.user = {
        id: '2',
        email: 'teacher@example.com',
        role: 'teacher',
        name: 'Teacher'
      };

      requireTeacher(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should return 403 for non-teacher role', () => {
      mockRequest.user = {
        id: '1',
        email: 'student@example.com',
        role: 'student',
        name: 'Student'
      };

      requireTeacher(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Teacher access required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware', () => {
    test('should pass for admin role', () => {
      mockRequest.user = {
        id: '3',
        email: 'admin@example.com',
        role: 'admin',
        name: 'Admin'
      };

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    test('should return 403 for non-admin role', () => {
      mockRequest.user = {
        id: '1',
        email: 'student@example.com',
        role: 'student',
        name: 'Student'
      };

      requireAdmin(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Admin access required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    test('should handle missing user object', () => {
      delete (mockRequest as any).user;

      requireStudent(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Student access required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('should handle malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat'
      };

      await auth(mockRequest as AuthRequest, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });
});
