import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { signupPayload } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';
import { MessagingError } from '../../src/messaging/whatsapp.js';

let t;
let sent; // [{ phone, code }] — what the WhatsApp client was asked to send
beforeAll(async () => {
  t = await createTestContext({ configOverrides: { otp: { mode: 'whatsapp', testCode: '123456' } } });
});
beforeEach(async () => {
  await t.reset();
  t.clock.set('2026-11-15T09:21:00Z');
  sent = [];
  t.ctx.whatsapp = {
    sendAuthCode: vi.fn(async (phone, code) => {
      sent.push({ phone, code });
      return { status: 'queued', transaction_id: 'tx-1' };
    }),
  };
});
afterAll(async () => {
  await t?.close();
});

const post = (path, body) => request(t.app).post(`/api/v1${path}`).send(body);
const requestSignup = (phone) => post('/auth/otp/request', { phone, purpose: 'signup', payload: signupPayload() });

describe('login codes on WhatsApp (OTP_MODE=whatsapp)', () => {
  test('a random 6-digit code is sent to the number (country code, no +), and that code signs the customer up', async () => {
    const res = await requestSignup('+966 55 123 4567');
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].phone).toBe('966551234567');
    expect(sent[0].code).toMatch(/^\d{6}$/);
    expect(sent[0].code).not.toBe('123456'); // the test code does not work in this mode
    expect((await post('/auth/otp/verify', { challengeId: res.body.challengeId, code: '123456' })).status).toBe(400);
    const verified = await post('/auth/otp/verify', { challengeId: res.body.challengeId, code: sent[0].code });
    expect(verified.status).toBe(200);
    expect(verified.body.user).toMatchObject({ phone: '551234567' });
  });

  test('an international number is sent as its digits', async () => {
    expect((await requestSignup('+971501234567')).status).toBe(200);
    expect(sent[0].phone).toBe('971501234567');
  });

  test('the code is never written to the server log', async () => {
    await requestSignup('551234567');
    const logged = JSON.stringify(t.logs);
    expect(logged).not.toContain(sent[0].code);
    expect(logged).toContain('…4567'); // only the last 4 digits of the number
    expect(logged).toContain('transaction tx-1'); // the API's transaction id, for tracing
  });

  test('a failed send is an error for the customer, nothing is stored, and the reason is logged', async () => {
    t.ctx.whatsapp.sendAuthCode = vi.fn(async () => {
      throw new MessagingError('rejected', 'WhatsApp API refused the message: Recipient is not in the allowed list');
    });
    const res = await requestSignup('551234567');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'otp_unavailable' });
    expect(res.body.message).toContain("can't send WhatsApp codes");
    expect(await t.db('otp_challenges').count({ n: '*' }).first()).toMatchObject({ n: 0 });
    expect(t.logs.some(([level, line]) => level === 'error' && line.includes('not in the allowed list'))).toBe(true);
  });

  test('Resend sends a new code (the old one stops working)', async () => {
    const first = await requestSignup('551234567');
    t.clock.advance(61_000);
    const again = await post('/auth/otp/resend', { challengeId: first.body.challengeId });
    expect(again.status).toBe(200);
    expect(sent).toHaveLength(2);
    expect((await post('/auth/otp/verify', { challengeId: first.body.challengeId, code: sent[0].code })).status).toBe(400);
    expect((await post('/auth/otp/verify', { challengeId: first.body.challengeId, code: sent[1].code })).status).toBe(200);
  });

  test('without a WhatsApp client set up the request fails clearly instead of pretending to send', async () => {
    t.ctx.whatsapp = null;
    const res = await requestSignup('551234567');
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('otp_unavailable');
  });
});
