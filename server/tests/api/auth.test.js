import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { DEMO_PASSWORD, DEMO_PHONE, seedDemo } from '../helpers/demoCustomer.js';
import { TEST_CODE, signUp, signupPayload } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';

let t;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  t.clock.set('2026-11-15T09:21:00Z');
});
afterAll(async () => {
  await t?.close();
});

const post = (path, body, auth) => {
  const req = request(t.app).post(`/api/v1${path}`);
  if (auth) req.set('Authorization', auth);
  return req.send(body);
};
const requestOtp = (phone, purpose, payload, auth) => post('/auth/otp/request', { phone, purpose, payload }, auth);
const verify = (challengeId, code = TEST_CODE, auth) => post('/auth/otp/verify', { challengeId, code }, auth);
const seed = () => seedDemo(t.db, { now: t.clock.now(), hashCost: 4 });

describe('sign up', () => {
  test('with a code: creates user, default Home address with coordinates, welcome notification, tokens', async () => {
    const req = await requestOtp('+966 55 123 4567', 'signup', signupPayload());
    expect(req.status).toBe(200);
    expect(req.body).toMatchObject({ phone: '551234567', purpose: 'signup', length: 6 });
    expect(new Date(req.body.resendAt).getTime() - t.clock.now().getTime()).toBe(60_000);

    const res = await verify(req.body.challengeId);
    expect(res.status).toBe(200);
    expect(res.body.next).toBe('home');
    expect(res.body.user).toMatchObject({ phone: '551234567', name: 'Noura Al-Qahtani', gender: 'female', hasPassword: false });
    expect(res.body.tokens).toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String), expiresIn: 900 });

    const [address] = await t.db('addresses').where({ user_id: res.body.user.id });
    expect(address).toMatchObject({ label: 'Home', type: 'home', is_default: 1, postcode: '31952', lat: 26.31402, phone: '551234567' });
    expect(await t.db('notifications').where({ user_id: res.body.user.id, type: 'welcome' })).toHaveLength(1);
  });

  test('with a registered phone → 409 phone_taken on field phone', async () => {
    await seed();
    const res = await requestOtp(DEMO_PHONE, 'signup', signupPayload());
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: 'This number already has a kuraat account.', code: 'phone_taken', field: 'phone' });
  });

  test('sign-up payload is required and its address must be in Saudi Arabia', async () => {
    expect((await requestOtp('551234567', 'signup')).body).toMatchObject({ code: 'invalid' });
    const outside = signupPayload({ address: { ...signupPayload().address, location: { lat: 51.5, lng: -0.12 } } });
    expect((await requestOtp('551234567', 'signup', outside)).body).toMatchObject({ code: 'out_of_area', field: 'address.location' });
  });

  test('"set a password instead" creates the account with hasPassword true', async () => {
    const req = await requestOtp('551234567', 'signup', signupPayload());
    const weak = await post('/auth/signup/password', { challengeId: req.body.challengeId, password: 'short' });
    expect(weak.body).toMatchObject({ code: 'weak_password', field: 'password' });
    const res = await post('/auth/signup/password', { challengeId: req.body.challengeId, password: 'Sweets@2026' });
    expect(res.status).toBe(200);
    expect(res.body.user.hasPassword).toBe(true);
    const types = (await t.db('notifications').where({ user_id: res.body.user.id })).map((n) => n.type).sort();
    expect(types).toEqual(['security', 'welcome']);
  });
});

describe('sign in', () => {
  test('with a code', async () => {
    await seed();
    const req = await requestOtp('0501234821', 'signin');
    const res = await verify(req.body.challengeId);
    expect(res.body).toMatchObject({ next: 'home', user: { phone: DEMO_PHONE, hasPassword: true } });
  });

  test('with a password; errors not_found, wrong_password, no_password', async () => {
    await seed();
    const ok = await post('/auth/signin', { phone: '50 123 4821', password: DEMO_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.body.user.name).toBe('Sara Al-Mutairi');

    const wrong = await post('/auth/signin', { phone: DEMO_PHONE, password: 'Nope@1234' });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ code: 'wrong_password', field: 'password' });

    const unknown = await post('/auth/signin', { phone: '561111111', password: DEMO_PASSWORD });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({ code: 'not_found', field: 'phone' });

    const { user } = await signUp(t.app);
    const noPassword = await post('/auth/signin', { phone: user.phone, password: 'Whatever1' });
    expect(noPassword.body).toMatchObject({ code: 'no_password', field: 'password' });
  });

  test('code for an unknown phone → 404 not_found', async () => {
    const res = await requestOtp('561111111', 'signin');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'not_found', field: 'phone' });
  });
});

describe('codes', () => {
  test('wrong code 4 times → wrong_code, 5th → expired_code, then even the right code is refused; 000000 is wrong', async () => {
    await seed();
    const { challengeId } = (await requestOtp(DEMO_PHONE, 'signin')).body;
    expect((await verify(challengeId, '000000')).body).toMatchObject({ code: 'wrong_code', field: 'code' });
    for (let i = 0; i < 3; i += 1) expect((await verify(challengeId, '111111')).body.code).toBe('wrong_code');
    expect((await verify(challengeId, '111111')).body).toMatchObject({ code: 'expired_code', field: 'code' });
    expect((await verify(challengeId)).body.code).toBe('expired_code');
  });

  test('a code older than 10 minutes → expired_code', async () => {
    await seed();
    const { challengeId } = (await requestOtp(DEMO_PHONE, 'signin')).body;
    t.clock.advance(10 * 60 * 1000 + 1);
    expect((await verify(challengeId)).body.code).toBe('expired_code');
  });

  test('resend before 60 s → 429 resend_too_soon; after → new code works', async () => {
    await seed();
    const { challengeId } = (await requestOtp(DEMO_PHONE, 'signin')).body;
    const early = await post('/auth/otp/resend', { challengeId });
    expect(early.status).toBe(429);
    expect(early.body.code).toBe('resend_too_soon');
    t.clock.advance(60_000);
    const again = await post('/auth/otp/resend', { challengeId });
    expect(again.status).toBe(200);
    expect((await verify(challengeId)).status).toBe(200);
  });

  test('a 6th code request for the same phone within 10 minutes → 429', async () => {
    await seed();
    for (let i = 0; i < 5; i += 1) expect((await requestOtp(DEMO_PHONE, 'signin')).status).toBe(200);
    const res = await requestOtp(DEMO_PHONE, 'signin');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('too_many_requests');
  });
});

describe('password reset', () => {
  test('a verified reset code lets you set a new password and signs you in; it cannot be used twice', async () => {
    await seed();
    const { challengeId } = (await requestOtp(DEMO_PHONE, 'reset')).body;
    const verified = await verify(challengeId);
    expect(verified.body).toEqual({ next: 'set-password', verificationToken: challengeId });
    const res = await post('/auth/password/reset', { verificationToken: challengeId, newPassword: 'NewPass@2027' });
    expect(res.status).toBe(200);
    expect(res.body.user.phone).toBe(DEMO_PHONE);
    expect((await post('/auth/signin', { phone: DEMO_PHONE, password: 'NewPass@2027' })).status).toBe(200);
    const again = await post('/auth/password/reset', { verificationToken: challengeId, newPassword: 'Other@2028x' });
    expect(again.body.code).toBe('expired');
  });

  test('an unverified reset challenge is refused', async () => {
    await seed();
    const { challengeId } = (await requestOtp(DEMO_PHONE, 'reset')).body;
    const res = await post('/auth/password/reset', { verificationToken: challengeId, newPassword: 'NewPass@2027' });
    expect(res.body.code).toBe('expired');
  });
});

describe('tokens', () => {
  test('refresh rotates: the old refresh token is refused after use, and reuse revokes the new one too', async () => {
    const { tokens } = await signUp(t.app);
    const first = await post('/auth/refresh', { refreshToken: tokens.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.tokens.refreshToken).not.toBe(tokens.refreshToken);
    const reuse = await post('/auth/refresh', { refreshToken: tokens.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.code).toBe('unauthorized');
    const afterReuse = await post('/auth/refresh', { refreshToken: first.body.tokens.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  test('sign out revokes the refresh token', async () => {
    const { tokens } = await signUp(t.app);
    expect((await post('/auth/signout', { refreshToken: tokens.refreshToken })).status).toBe(204);
    expect((await post('/auth/refresh', { refreshToken: tokens.refreshToken })).status).toBe(401);
  });

  test('access tokens expire after 15 minutes', async () => {
    const { auth } = await signUp(t.app);
    expect((await request(t.app).get('/api/v1/me').set('Authorization', auth)).status).toBe(200);
    t.clock.advance(15 * 60 * 1000 + 1000);
    const res = await request(t.app).get('/api/v1/me').set('Authorization', auth);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please sign in again.', code: 'unauthorized', field: null });
  });
});
