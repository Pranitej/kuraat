import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { saveCard } from '../../src/modules/cards/routes.js';
import { notify } from '../../src/modules/notifications/service.js';
import { signInDemo } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';

let t;
let me;
beforeAll(async () => {
  t = await createTestContext();
});
beforeEach(async () => {
  await t.reset();
  t.clock.set('2026-11-15T09:21:00Z');
  me = await signInDemo(t);
});
afterAll(async () => {
  await t?.close();
});

const api = (method, path, body) => {
  const req = request(t.app)[method](`/api/v1${path}`).set('Authorization', me.auth);
  return body === undefined ? req : req.send(body);
};

describe('favourites', () => {
  test('round-trip keeps order and removes duplicates', async () => {
    expect((await api('get', '/favorites')).body).toEqual({ productIds: [] });
    const res = await api('put', '/favorites', { productIds: ['p2', 'p1', 'p2'] });
    expect(res.body).toEqual({ productIds: ['p2', 'p1'] });
    expect((await api('get', '/favorites')).body).toEqual({ productIds: ['p2', 'p1'] });
    expect((await api('put', '/favorites', { productIds: [] })).body).toEqual({ productIds: [] });
  });
});

describe('saved cards', () => {
  test('list and delete; saving the same card twice keeps one and updates the expiry', async () => {
    await saveCard(t.db, me.user.id, { brand: 'Visa', last4: '4242', expiry: '12/28' }, t.clock.now());
    await saveCard(t.db, me.user.id, { brand: 'Visa', last4: '4242', expiry: '12/29' }, t.clock.now());
    const list = (await api('get', '/cards')).body;
    expect(list).toEqual([{ id: expect.any(String), brand: 'Visa', last4: '4242', expiry: '12/29' }]);
    expect((await api('delete', `/cards/${list[0].id}`)).status).toBe(204);
    expect((await api('get', '/cards')).body).toEqual([]);
    expect((await api('delete', `/cards/${list[0].id}`)).status).toBe(404);
  });
});

describe('notifications', () => {
  test('newest first; mark one read; mark all read', async () => {
    t.clock.advance(60_000);
    await notify(t.db, me.user.id, { type: 'order', title: 'Order #KR-20418 confirmed', body: 'x', link: { kind: 'order', id: 'o1' } }, t.clock.now());
    const list = (await api('get', '/notifications')).body;
    expect(list.map((n) => n.type)).toEqual(['order', 'welcome']);
    expect(list[0]).toMatchObject({ read: false, link: { kind: 'order', id: 'o1' }, createdAt: '2026-11-15T09:22:00.000Z' });

    const one = await api('post', `/notifications/${list[0].id}/read`);
    expect(one.body).toMatchObject({ id: list[0].id, read: true });
    const all = await api('post', '/notifications/read-all');
    expect(all.body).toEqual({ updated: 1 });
    expect((await api('get', '/notifications')).body.every((n) => n.read)).toBe(true);
  });

  test('unknown notification → 404', async () => {
    expect((await api('post', '/notifications/00000000-0000-4000-8000-000000000000/read')).status).toBe(404);
  });
});
