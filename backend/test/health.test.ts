import request from 'supertest';
import express from 'express';
import { describe, test, expect } from '@jest/globals';

// Create a simple test app without database dependencies
const testApp = express();

testApp.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

describe('Basic Health Check', () => {
  test('GET /health returns 200', async () => {
    const response = await request(testApp)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('Health endpoint returns JSON', async () => {
    const response = await request(testApp)
      .get('/health')
      .expect(200);
    
    expect(response.headers['content-type']).toMatch(/json/);
  });
});
