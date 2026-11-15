import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTestContext } from '../helpers/context.js';

let t;
beforeAll(async () => { t = await createTestContext(); });
afterAll(async () => { await t?.close(); });

describe('health and errors', () => {
  test('GET /api/v1/health reports db ok', async () => {
    const res = await request(t.app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });

  test('unknown route → 404 route_not_found in the error shape', async () => {
    const res = await request(t.app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: expect.any(String), code: 'route_not_found', field: null });
  });

  test('malformed JSON → 400 invalid_json in the error shape', async () => {
    const res = await request(t.app).post('/api/v1/health').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'invalid_json', field: null });
  });
});
