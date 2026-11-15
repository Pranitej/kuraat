/**
 * Demo seed — the realistic starting state for the client demo (PDF placeholders: Sara Al-Mutairi,
 * +966 50 123 4821, Building 14 King Fahd Rd, orders KR-20377 / KR-20291 …). Dates are generated
 * relative to "now" so the demo always looks current.
 *
 * Demo sign-in: mobile 50 123 4821 · password Kuraat@2026 (or any WhatsApp code).
 */

import { hashPassword } from './hash.js';
import { orderSchedule } from './delivery.js';

export const DEMO_USER_PHONE = '501234821';
export const DEMO_USER_PASSWORD = 'Kuraat@2026';
export const SEED_VERSION = 4;

const DAY = 24 * 3600 * 1000;

function daysAgo(now, days, hours, minutes) {
  const d = new Date(now.getTime() - days * DAY);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function createDemoSeed(now = new Date()) {
  const userId = 'u_sara';
  const home = {
    id: 'addr_home',
    label: 'Home',
    type: 'home',
    line: 'Building 14, King Fahd Rd',
    district: 'Al Rakah',
    city: 'Al Khobar',
    postcode: '34445',
    landmark: 'Near Al Rakah Park',
    contactName: 'Sara Al-Mutairi',
    phone: '501234821',
    isDefault: true,
    location: { lat: 26.2874, lng: 50.2085 },
  };
  const office = {
    id: 'addr_office',
    label: 'Office',
    type: 'office',
    line: 'Tower B, Level 6, Prince Turki St',
    district: 'Al Yarmouk',
    city: 'Al Khobar',
    postcode: '31952',
    landmark: '',
    contactName: 'Sara Al-Mutairi',
    phone: '501234821',
    isDefault: false,
    location: { lat: 26.31245, lng: 50.22807 },
  };
  const parents = {
    id: 'addr_parents',
    label: 'Parents’ home',
    type: 'other',
    line: 'Villa 8',
    district: 'Al Faisaliyah District',
    city: 'Dammam',
    postcode: '32245',
    landmark: '',
    contactName: 'Sara Al-Mutairi',
    phone: '559876543',
    isDefault: false,
    location: { lat: 26.38552, lng: 50.14525 },
  };

  const o1Created = daysAgo(now, 7, 13, 5);
  const o2Created = daysAgo(now, 17, 11, 40);

  const orders = [
    {
      id: 'KR-20377',
      userId,
      items: [
        { productId: 'burnt-chocolate-cheesecake', qty: 2, price: 28 },
        { productId: 'cinnamon-roll', qty: 1, price: 22 },
      ],
      subtotal: 78,
      discount: 0,
      delivery: 15,
      total: 93,
      vat: 12.13,
      promoCode: null,
      branchId: 'khobar-corniche',
      distanceKm: 2.4,
      address: { ...home },
      deliveryPhone: '501234821',
      payment: { method: 'card', brand: 'Visa', last4: '4242', transactionId: 'TXN-61C0B7E2' },
      schedule: orderSchedule(o1Created),
      statusNotified: ['out_for_delivery', 'delivered'],
    },
    {
      id: 'KR-20291',
      userId,
      items: [{ productId: 'truffle-box-praline', qty: 1, price: 185 }],
      subtotal: 185,
      discount: 0,
      delivery: 15,
      total: 200,
      vat: 26.09,
      promoCode: null,
      branchId: 'dhahran-king-abdulaziz',
      distanceKm: 6.8,
      address: { ...home },
      deliveryPhone: '501234821',
      payment: { method: 'card', brand: 'Visa', last4: '4242', transactionId: 'TXN-3D9A40F7' },
      schedule: orderSchedule(o2Created),
      statusNotified: ['out_for_delivery', 'delivered'],
    },
  ];

  const notifications = [
    {
      id: 'n_seed_1',
      type: 'delivered',
      title: 'Order #KR-20377 delivered',
      body: 'Delivered from Kuraat · Al Khobar Corniche. Enjoy!',
      createdAt: orders[0].schedule.deliveredAt,
      read: true,
      link: { kind: 'order', id: 'KR-20377' },
    },
    {
      id: 'n_seed_2',
      type: 'product',
      title: 'New: Praline Truffle Box',
      body: 'Hazelnut praline truffles are now in the orange gift box.',
      createdAt: daysAgo(now, 10, 10, 0).toISOString(),
      read: false,
      link: { kind: 'product', id: 'truffle-box-praline' },
    },
    {
      id: 'n_seed_3',
      type: 'security',
      title: 'Password updated',
      body: 'Your password was changed successfully.',
      createdAt: daysAgo(now, 17, 9, 15).toISOString(),
      read: true,
      link: { kind: 'password' },
    },
  ];

  return {
    version: SEED_VERSION,
    meta: { orderSeq: 20417 },
    users: [
      {
        id: userId,
        name: 'Sara Al-Mutairi',
        phone: DEMO_USER_PHONE,
        gender: 'female',
        email: 'sara.m@example.com',
        avatar: null,
        passwordHash: hashPassword(userId, DEMO_USER_PASSWORD),
        hasPassword: true,
        createdAt: daysAgo(now, 62, 12, 5).toISOString(),
      },
    ],
    addresses: { [userId]: [home, office, parents] },
    orders: { [userId]: orders },
    notifications: { [userId]: notifications },
    carts: {
      [userId]: {
        items: [
          { productId: 'truffle-box-classic', qty: 1 },
          { productId: 'butter-croissant-box', qty: 2 },
        ],
        promoCode: null,
      },
    },
    favorites: { [userId]: [] },
    savedCards: { [userId]: [] },
  };
}

/** Welcome notification for brand-new accounts. */
export function welcomeNotification(now = new Date()) {
  return {
    id: `n_welcome_${now.getTime()}`,
    type: 'welcome',
    title: 'Welcome to kuraat',
    body: 'Your account is ready. Explore our truffles, cakes and pastries.',
    createdAt: now.toISOString(),
    read: false,
    link: { kind: 'home' },
  };
}
