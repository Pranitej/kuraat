/** Test helpers for accounts: sign up / sign in through the real API. */
import request from 'supertest';
import { DEMO_PASSWORD, DEMO_PHONE, seedDemo } from './demoCustomer.js';

export const TEST_CODE = '123456';

export const signupPayload = (overrides = {}) => ({
  name: 'Noura Al-Qahtani',
  gender: 'female',
  address: {
    line: 'Building 3, Prince Turki St',
    district: 'Al Yarmouk',
    city: 'Al Khobar',
    location: { lat: 26.31402, lng: 50.223148 },
  },
  ...overrides,
});

/** Sign up with the WhatsApp test code. Returns { user, tokens, auth } where auth is a header value. */
export async function signUp(app, { phone = '551234567', payload = signupPayload() } = {}) {
  const req = await request(app).post('/api/v1/auth/otp/request').send({ phone, purpose: 'signup', payload });
  if (req.status !== 200) throw new Error(`otp/request ${req.status} ${JSON.stringify(req.body)}`);
  const res = await request(app).post('/api/v1/auth/otp/verify').send({ challengeId: req.body.challengeId, code: TEST_CODE });
  if (res.status !== 200) throw new Error(`otp/verify ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, auth: `Bearer ${res.body.tokens.accessToken}` };
}

/** Seed the demo customer and sign in with the password. */
export async function signInDemo(t) {
  await seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });
  const res = await request(t.app).post('/api/v1/auth/signin').send({ phone: DEMO_PHONE, password: DEMO_PASSWORD });
  if (res.status !== 200) throw new Error(`signin ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, auth: `Bearer ${res.body.tokens.accessToken}` };
}
