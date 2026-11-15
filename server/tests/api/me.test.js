import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { DEMO_PASSWORD } from '../../src/db/seedDemo.js';
import { TEST_CODE, signInDemo, signUp } from '../helpers/auth.js';
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

const api = (method, path, auth, body) => {
  const req = request(t.app)[method](`/api/v1${path}`);
  if (auth) req.set('Authorization', auth);
  return body === undefined ? req : req.send(body);
};

describe('/me', () => {
  test('without a token → 401 unauthorized in the error shape', async () => {
    const res = await api('get', '/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Please sign in again.', code: 'unauthorized', field: null });
  });

  test('GET returns the public user without the password hash', async () => {
    const { auth } = await signInDemo(t);
    const res = await api('get', '/me', auth);
    expect(res.body).toMatchObject({ phone: '501234821', name: 'Sara Al-Mutairi', email: 'sara.m@example.com', hasPassword: true });
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash/);
  });

  test('PATCH updates name, email, gender and avatar; rejects a non-image avatar', async () => {
    const { auth } = await signInDemo(t);
    const avatar = `data:image/jpeg;base64,${'A'.repeat(100)}`;
    const res = await api('patch', '/me', auth, { name: ' Sara M ', email: 'sara@example.com', gender: 'female', avatar });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Sara M', email: 'sara@example.com', avatar });
    const bad = await api('patch', '/me', auth, { avatar: 'https://evil.example/x.png' });
    expect(bad.body).toMatchObject({ code: 'invalid', field: 'avatar' });
  });

  test('phone change needs a verified change-phone code for that number', async () => {
    const { auth } = await signInDemo(t);
    const direct = await api('patch', '/me', auth, { phone: '561234567' });
    expect(direct.body).toMatchObject({ code: 'unverified_phone', field: 'phone' });

    const otp = await api('post', '/auth/otp/request', auth, { phone: '561234567', purpose: 'change-phone' });
    const verified = await api('post', '/auth/otp/verify', auth, { challengeId: otp.body.challengeId, code: TEST_CODE });
    expect(verified.body.next).toBe('account');
    const res = await api('patch', '/me', auth, { phone: '561234567', verificationToken: verified.body.verificationToken });
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('561234567');
  });

  test('change-phone to a registered number → 409 phone_taken', async () => {
    const other = await signUp(t.app, { phone: '561234567' });
    expect(other.user.phone).toBe('561234567');
    const { auth } = await signInDemo(t);
    const otp = await api('post', '/auth/otp/request', auth, { phone: '561234567', purpose: 'change-phone' });
    expect(otp.status).toBe(409);
    expect(otp.body.code).toBe('phone_taken');
  });

  test('change-phone needs a signed-in user', async () => {
    const res = await api('post', '/auth/otp/request', null, { phone: '561234567', purpose: 'change-phone' });
    expect(res.status).toBe(401);
  });
});

describe('PUT /me/password', () => {
  test('wrong_password, same_password, weak_password, then success with a security notification', async () => {
    const { auth } = await signInDemo(t);
    expect((await api('put', '/me/password', auth, { currentPassword: 'Wrong@123', newPassword: 'New@2027x' })).body).toMatchObject({
      code: 'wrong_password',
      field: 'currentPassword',
    });
    expect((await api('put', '/me/password', auth, { currentPassword: DEMO_PASSWORD, newPassword: DEMO_PASSWORD })).body).toMatchObject({
      code: 'same_password',
      field: 'newPassword',
    });
    expect((await api('put', '/me/password', auth, { currentPassword: DEMO_PASSWORD, newPassword: 'short' })).body).toMatchObject({
      code: 'weak_password',
      field: 'newPassword',
    });
    const ok = await api('put', '/me/password', auth, { currentPassword: DEMO_PASSWORD, newPassword: 'New@2027x' });
    expect(ok.status).toBe(200);
    const security = await t.db('notifications').where({ type: 'security' });
    expect(security.map((n) => n.title)).toEqual(['Password updated']);
  });

  test('a user without a password can set one without currentPassword', async () => {
    const { auth } = await signUp(t.app);
    const res = await api('put', '/me/password', auth, { newPassword: 'First@2026' });
    expect(res.status).toBe(200);
    expect(res.body.hasPassword).toBe(true);
    expect((await t.db('notifications').where({ type: 'security' }))[0].title).toBe('Password set');
  });
});
