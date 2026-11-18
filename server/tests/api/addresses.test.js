import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { signInDemo, signUp } from '../helpers/auth.js';
import { createTestContext } from '../helpers/context.js';

let t;
let auth;
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

const api = (method, path, body, as = auth) => {
  const req = request(t.app)[method](`/api/v1${path}`).set('Authorization', as);
  return body === undefined ? req : req.send(body);
};

const input = (overrides = {}) => ({
  type: 'office',
  line: 'Tower B, Level 6, Prince Turki St',
  district: 'Al Yarmouk',
  city: 'Al Khobar',
  landmark: '',
  location: { lat: 26.31402, lng: 50.223148 },
  ...overrides,
});

describe('address book', () => {
  test('list: default first, then oldest first, in our shape', async () => {
    ({ auth } = await signInDemo(t));
    const res = await api('get', '/addresses');
    expect(res.status).toBe(200);
    expect(res.body.map((a) => a.label)).toEqual(['Home', 'Office', 'Parents’ home']);
    expect(res.body[0]).toMatchObject({
      type: 'home',
      line: 'Building 14, King Fahd Rd',
      district: 'Al Rakah',
      city: 'Al Khobar',
      postcode: '34445',
      landmark: 'Near Al Rakah Park',
      contactName: 'Sara Al-Mutairi',
      location: { lat: 26.348558, lng: 50.193673 },
      isDefault: true,
    });
  });

  test('create fills label and contact name (no made-up postcode); isDefault moves the default', async () => {
    ({ auth } = await signInDemo(t));
    const res = await api('post', '/addresses', input({ type: 'other', label: '  Gym ', isDefault: true }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ label: 'Gym', postcode: '', contactName: 'Sara Al-Mutairi', isDefault: true });
    expect(res.body).not.toHaveProperty('phone'); // an address has no mobile number: the customer has one, on the account
    expect((await t.db('addresses').where({ id: res.body.id }).first())).not.toHaveProperty('phone');
    const list = (await api('get', '/addresses')).body;
    expect(list.filter((a) => a.isDefault).map((a) => a.label)).toEqual(['Gym']);
    expect(list[0].label).toBe('Gym');
  });

  test('an "other" address without a label is called Other and does not take the default', async () => {
    ({ auth } = await signUp(t.app));
    const res = await api('post', '/addresses', input({ type: 'other' }));
    expect(res.body).toMatchObject({ label: 'Other', isDefault: false });
  });

  test('setting another default leaves exactly one default', async () => {
    ({ auth } = await signInDemo(t));
    const office = (await api('get', '/addresses')).body.find((a) => a.label === 'Office');
    const res = await api('post', `/addresses/${office.id}/default`);
    expect(res.status).toBe(200);
    expect(res.body.filter((a) => a.isDefault).map((a) => a.label)).toEqual(['Office']);
  });

  test('deleting the default hands the default to the oldest remaining address', async () => {
    ({ auth } = await signInDemo(t));
    const home = (await api('get', '/addresses')).body.find((a) => a.label === 'Home');
    expect((await api('delete', `/addresses/${home.id}`)).status).toBe(204);
    const list = (await api('get', '/addresses')).body;
    expect(list.map((a) => [a.label, a.isDefault])).toEqual([
      ['Office', true],
      ['Parents’ home', false],
    ]);
  });

  test('un-defaulting the default address hands the default to the oldest other one', async () => {
    ({ auth } = await signInDemo(t));
    const home = (await api('get', '/addresses')).body.find((a) => a.label === 'Home');
    const res = await api('patch', `/addresses/${home.id}`, input({ type: 'home', line: 'Building 15, King Fahd Rd', isDefault: false }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ line: 'Building 15, King Fahd Rd', isDefault: false });
    const list = (await api('get', '/addresses')).body;
    expect(list.find((a) => a.isDefault).label).toBe('Office');
  });

  test('the location is optional: an address without one is saved with location null; a location outside Saudi → out_of_area', async () => {
    ({ auth } = await signInDemo(t));
    const { location, ...noLocation } = input();
    expect(location).toBeDefined();
    const saved = await api('post', '/addresses', noLocation);
    expect(saved.status).toBe(201);
    expect(saved.body.location).toBeNull();
    expect((await t.db('addresses').where({ id: saved.body.id }).first())).toMatchObject({ lat: null, lng: null });
    // Sharing it later (e.g. "Use current location") fills it in.
    const shared = await api('patch', `/addresses/${saved.body.id}`, input());
    expect(shared.body.location).toEqual({ lat: 26.31402, lng: 50.223148 });
    expect((await api('post', '/addresses', input({ location: { lat: 25.2, lng: 55.27 + 10 } }))).body).toMatchObject({
      code: 'out_of_area',
      field: 'location',
    });
  });

  test("another user's address → 404 not_found", async () => {
    ({ auth } = await signInDemo(t));
    const demoHome = (await api('get', '/addresses')).body[0];
    const other = await signUp(t.app);
    expect((await api('patch', `/addresses/${demoHome.id}`, input(), other.auth)).status).toBe(404);
    expect((await api('delete', `/addresses/${demoHome.id}`, undefined, other.auth)).status).toBe(404);
    expect((await api('post', `/addresses/${demoHome.id}/default`, undefined, other.auth)).body.code).toBe('not_found');
  });

  test('requires sign-in', async () => {
    expect((await request(t.app).get('/api/v1/addresses')).status).toBe(401);
  });
});
