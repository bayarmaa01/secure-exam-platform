import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Pool, PoolClient } from 'pg';
import { pool, initDb } from '../src/db';

// Mock pg Pool
jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn()
  };
  return { Pool: jest.fn(() => mockPool) };
});

import { Pool as MockPool } from 'pg';

describe('Database Module', () => {
  let mockPool: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = new MockPool();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Pool Configuration', () => {
    test('should initialize pool with correct configuration', () => {
      expect(MockPool).toHaveBeenCalledWith({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'exam_platform',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 50,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    });

    test('should use environment variables when available', () => {
      process.env.DB_HOST = 'test-host';
      process.env.DB_PORT = '5433';
      process.env.DB_NAME = 'test-db';
      process.env.DB_USER = 'test-user';
      process.env.DB_PASSWORD = 'test-password';

      // Re-require the module to test with new environment variables
      jest.resetModules();
      const { Pool: NewMockPool } = require('pg');
      new NewMockPool();

      expect(NewMockPool).toHaveBeenCalledWith({
        host: 'test-host',
        port: 5433,
        database: 'test-db',
        user: 'test-user',
        password: 'test-password',
        max: 50,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Clean up environment variables
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.DB_NAME;
      delete process.env.DB_USER;
      delete process.env.DB_PASSWORD;
    });
  });

  describe('Pool Query Method', () => {
    test('should execute query successfully', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1
      };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await pool.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
    });

    test('should handle query errors', async () => {
      const error = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(error);

      await expect(pool.query('SELECT * FROM users')).rejects.toThrow('Database connection failed');
    });

    test('should execute query without parameters', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1
      };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await pool.query('SELECT * FROM users');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users', []);
      expect(result).toEqual(mockResult);
    });

    test('should handle multiple parameters', async () => {
      const mockResult = {
        rows: [{ id: 1, name: 'Test' }],
        rowCount: 1
      };
      mockPool.query.mockResolvedValue(mockResult);

      const result = await pool.query('SELECT * FROM users WHERE id = $1 AND active = $2', [1, true]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1 AND active = $2', [1, true]);
      expect(result).toEqual(mockResult);
    });
  });

  describe('Pool Connect Method', () => {
    test('should get database client successfully', async () => {
      mockPool.connect.mockResolvedValue(mockClient);

      const client = await pool.connect();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });

    test('should handle client connection errors', async () => {
      const error = new Error('Failed to connect to database');
      mockPool.connect.mockRejectedValue(error);

      await expect(pool.connect()).rejects.toThrow('Failed to connect to database');
    });

    test('should return client with release method', async () => {
      mockPool.connect.mockResolvedValue(mockClient);

      const client = await pool.connect();

      expect(typeof client.release).toBe('function');
      expect(mockClient.release).toBeDefined();
    });
  });

  describe('initDb function', () => {
    test('should initialize database successfully', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(initDb()).resolves.not.toThrow();
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      const error = new Error('Database initialization failed');
      mockPool.connect.mockRejectedValue(error);

      await expect(initDb()).rejects.toThrow('Database initialization failed');
    });

    test('should retry initialization on failure', async () => {
      process.env.DB_RETRY_ATTEMPTS = '2';
      process.env.DB_RETRY_DELAY = '100';

      mockPool.connect
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(mockClient);
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(initDb()).resolves.not.toThrow();
      expect(mockPool.connect).toHaveBeenCalledTimes(2);

      // Clean up
      delete process.env.DB_RETRY_ATTEMPTS;
      delete process.env.DB_RETRY_DELAY;
    });
  });

  describe('Query Parameter Validation', () => {
    test('should handle null parameters', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult);

      await pool.query('SELECT * FROM users WHERE name IS NULL');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE name IS NULL', []);
    });

    test('should handle undefined parameters', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult);

      await pool.query('SELECT * FROM users WHERE active = $1', [undefined]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE active = $1', [undefined]);
    });

    test('should handle empty string parameters', async () => {
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockResolvedValue(mockResult);

      await pool.query('SELECT * FROM users WHERE name = $1', ['']);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE name = $1', ['']);
    });
  });
});
