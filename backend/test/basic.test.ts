import request from 'supertest';
import { app } from '../dist/index.js';

describe('Basic API Tests', () => {
  test('Health check endpoint', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });

  test('Auth endpoints exist', async () => {
    // Test that endpoints exist (not full functionality)
    await request(app)
      .post('/api/auth/register')
      .send({})
      .expect(400); // Should fail validation but endpoint exists

    await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400); // Should fail validation but endpoint exists
  });
});
