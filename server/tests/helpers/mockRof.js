/** Helpers for talking to an in-process fake ROF in tests. */
import request from 'supertest';
import { createMockRof } from '../../mock-rof/app.js';
import { createSeed } from '../../mock-rof/seed.js';
import { createStore } from '../../mock-rof/store.js';

export function createMockRofHarness({ now = () => new Date('2026-11-15T09:21:00Z'), data = createSeed() } = {}) {
  const store = createStore({ data });
  const app = createMockRof({ store, now });
  let token = null;

  const harness = {
    store,
    app,
    async login() {
      const { email, password } = store.data.credentials;
      const res = await request(app).post('/api/auth/login').send({ email, password });
      token = res.body.data.token;
      return token;
    },
    async call(method, path, body) {
      if (!token) await harness.login();
      let req = request(app)[method](path).set('Authorization', `Bearer ${token}`);
      if (body !== undefined) req = req.send(body);
      return req;
    },
    /** Starts the fake ROF on a random port; returns { baseUrl, close }. */
    listen() {
      return new Promise((resolve) => {
        const server = app.listen(0, () => {
          const { port } = server.address();
          resolve({ baseUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
        });
      });
    },
  };
  return harness;
}
