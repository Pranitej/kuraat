/**
 * Demo customer for local testing and UAT walkthroughs (listed in the local TEST_CREDENTIALS.md).
 * Data from client/src/domain/demo.js (the PDF's Sara Al-Mutairi); coordinates are real
 * (OpenStreetMap lookups of King Fahd Rd · Al Rakah, Prince Turki St · Al Yarmouk, Al Faisaliyah).
 * Safe to run repeatedly: does nothing if the demo phone already exists.
 */
import bcrypt from 'bcryptjs';
import { newId } from '../lib/ids.js';

export const DEMO_PHONE = '501234821';
export const DEMO_PASSWORD = 'Kuraat@2026';

const ADDRESSES = [
  {
    label: 'Home',
    type: 'home',
    line: 'Building 14, King Fahd Rd',
    district: 'Al Rakah',
    city: 'Al Khobar',
    postcode: '34445',
    landmark: 'Near Al Rakah Park',
    phone: '501234821',
    lat: 26.348558,
    lng: 50.193673,
    is_default: true,
  },
  {
    label: 'Office',
    type: 'office',
    line: 'Tower B, Level 6, Prince Turki St',
    district: 'Al Yarmouk',
    city: 'Al Khobar',
    postcode: '31952',
    landmark: '',
    phone: '501234821',
    lat: 26.31402,
    lng: 50.223148,
    is_default: false,
  },
  {
    label: 'Parents’ home',
    type: 'other',
    line: 'Villa 8',
    district: 'Al Faisaliyah District',
    city: 'Dammam',
    postcode: '32245',
    landmark: '',
    phone: '559876543',
    lat: 26.393149,
    lng: 50.063535,
    is_default: false,
  },
];

export async function seedDemo(db, { now = new Date(), hashCost = 12 } = {}) {
  const existing = await db('users').where({ phone: DEMO_PHONE }).first();
  if (existing) return { userId: existing.id, created: false };

  const userId = newId();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, hashCost);
  await db.transaction(async (trx) => {
    await trx('users').insert({
      id: userId,
      phone: DEMO_PHONE,
      name: 'Sara Al-Mutairi',
      email: 'sara.m@example.com',
      gender: 'female',
      avatar: null,
      password_hash: passwordHash,
      created_at: now,
      updated_at: now,
    });
    // Stagger created_at so the list order (Home, Office, Parents) is stable.
    await trx('addresses').insert(
      ADDRESSES.map((a, i) => ({
        id: newId(),
        user_id: userId,
        contact_name: 'Sara Al-Mutairi',
        ...a,
        created_at: new Date(now.getTime() + i),
        updated_at: new Date(now.getTime() + i),
      })),
    );
    await trx('carts').insert({ user_id: userId, items: JSON.stringify([]), promo_code: null, created_at: now, updated_at: now });
    await trx('notifications').insert({
      id: newId(),
      user_id: userId,
      type: 'welcome',
      title: 'Welcome to kuraat',
      body: 'Your account is ready. Explore our truffles, cakes and pastries.',
      link: JSON.stringify({ kind: 'home' }),
      read: false,
      created_at: now,
    });
  });
  return { userId, created: true };
}
