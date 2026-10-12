import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns 200 OK and expected Sentinel health payload', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      service: 'sentinel-api'
    });
  });

  it('handles 404 for unknown endpoints gracefully', async () => {
    const response = await request(app)
      .get('/api/unknown-endpoint')
      .expect(404);

    expect(response.body.status).toBe('error');
    expect(response.body.statusCode).toBe(404);
  });
});
