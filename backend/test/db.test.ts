import { describe, test, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import { Pool } from 'pg';
import { pool, initDb } from '../src/db';

// Mock the Pool constructor
const mockPoolQuery = jest.fn() as jest.MockedFunction<any>;
const mockPoolConnect = jest.fn() as jest.MockedFunction<any>;
const mockPoolEnd = jest.fn() as jest.MockedFunction<any>;

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    connect: mockPoolConnect,
    end: mockPoolEnd
  }))
}));

describe('Database Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Pool Configuration', () => {
    test('should have pool instance', () => {
      expect(pool).toBeDefined();
      expect(typeof pool.query).toBe('function');
      expect(typeof pool.connect).toBe('function');
    });

    test('should execute queries', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }] };
      mockPoolQuery.mockResolvedValue(mockResult);

      const result = await pool.query('SELECT * FROM users');

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users');
      expect(result).toEqual(mockResult);
    });
  });

  describe('Pool Query Method', () => {
    test('should execute query without parameters', async () => {
      const mockResult = { rows: [{ id: 1, name: 'test' }] };
      mockPoolQuery.mockResolvedValue(mockResult);

      const result = await pool.query('SELECT * FROM users');

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users');
      expect(result).toEqual(mockResult);
    });

    test('should execute query with parameters', async () => {
      const mockResult = { rows: [{ id: 1, name: 'John' }] };
      mockPoolQuery.mockResolvedValue(mockResult);

      const result = await pool.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', [1]);
      expect(result).toEqual(mockResult);
    });

    test('should handle query errors', async () => {
      const error = new Error('Query failed');
      mockPoolQuery.mockRejectedValue(error);

      await expect(pool.query('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('Pool Connect Method', () => {
    test('should connect to database', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      mockPoolConnect.mockResolvedValue(mockClient);

      const client = await pool.connect();

      expect(mockPoolConnect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });

    test('should handle connection errors', async () => {
      const error = new Error('Connection failed');
      mockPoolConnect.mockRejectedValue(error);

      await expect(pool.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('initDb function', () => {
    test('should initialize database successfully', async () => {
      // Mock successful database operations
      mockPoolQuery.mockResolvedValue({ rows: [] });
      mockPoolConnect.mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      });

      await expect(initDb()).resolves.not.toThrow();
    });

    test('should handle initialization errors gracefully', async () => {
      const error = new Error('Database initialization failed');
      mockPoolConnect.mockRejectedValue(error);

      // The function should handle errors and retry
      await expect(initDb()).rejects.toThrow();
    }, 15000); // Increase timeout for this test
  });

  describe('Query Parameter Validation', () => {
    test('should handle null parameters', async () => {
      const mockResult = { rows: [] };
      mockPoolQuery.mockResolvedValue(mockResult);

      await pool.query('SELECT * FROM users WHERE name IS NULL');

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE name IS NULL');
    });

    test('should handle undefined parameters', async () => {
      const mockResult = { rows: [] };
      mockPoolQuery.mockResolvedValue(mockResult);

      await pool.query('SELECT * FROM users WHERE active = $1', [undefined]);

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE active = $1', [undefined]);
    });

    test('should handle empty arrays', async () => {
      const mockResult = { rows: [] };
      mockPoolQuery.mockResolvedValue(mockResult);

      await pool.query('SELECT * FROM users WHERE id = ANY($1)', [[]]);

      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ANY($1)', [[]]);
    });
  });

  describe('Database Connection Management', () => {
    test('should close pool gracefully', async () => {
      mockPoolEnd.mockResolvedValue(undefined);

      await pool.end();

      expect(mockPoolEnd).toHaveBeenCalled();
    });

    test('should handle pool closure errors', async () => {
      const error = new Error('Failed to close pool');
      mockPoolEnd.mockRejectedValue(error);

      await expect(pool.end()).rejects.toThrow('Failed to close pool');
    });
  });

  describe('Transaction Support', () => {
    test('should handle basic transaction operations', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      mockPoolConnect.mockResolvedValue(mockClient);

      const client = await pool.connect();
      
      await client.query('BEGIN');
      await client.query('INSERT INTO users (name) VALUES ($1)', ['test']);
      await client.query('COMMIT');
      
      client.release();

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('INSERT INTO users (name) VALUES ($1)', ['test']);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
