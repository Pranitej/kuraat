/**
 * Demo customer for local testing and UAT walkthroughs (listed in the local TEST_CREDENTIALS.md).
 * Data from client/src/domain/demo.js (the PDF's Sara Al-Mutairi); coordinates are real
 * (OpenStreetMap lookups of King Fahd Rd · Al Rakah, Prince Turki St · Al Yarmouk, Al Faisaliyah).
 * Safe to run repeatedly: an existing demo customer is kept; demo extras are added only once.
 */
import bcrypt from 'bcryptjs';
import { roundedDistance } from '../lib/geo.js';
import { newId } from '../lib/ids.js';
import { listAddresses, toAddress } from '../modules/addresses/routes.js';
import { saveCart } from '../modules/cart/routes.js';
import { computeTotals } from '../modules/cart/pricing.js';
import { estimates } from '../modules/checkout/window.js';
import { toOrderItems, toOrderSnapshot } from '../rof/adapter.js';
import { isRofError } from '../rof/errors.js';

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

/**
 * Adds the demo customer if missing. With a ROF-backed `ctx` and the fake ROF's `demoOrders`, it
 * also adds the PDF's demo extras once — the two delivered past orders (read from ROF, so they
 * exist only where ROF has them), the PDF cart and the PDF notifications.
 * @returns {{ userId, created: boolean, ordersAdded: number, skipped: string|null }}
 */
export async function seedDemo(db, { now = new Date(), hashCost = 12, ctx = null, demoOrders = [] } = {}) {
  const existing = await db('users').where({ phone: DEMO_PHONE }).first();
  const userId = existing ? existing.id : await createDemoCustomer(db, { now, hashCost });
  const created = !existing;
  if (!ctx?.rof) return { userId, created, ordersAdded: 0, skipped: 'no ROF connection given, so no past orders or cart' };

  const ids = demoOrders.map((o) => o.id);
  if (!ids.length || (await db('orders').whereIn('rof_order_id', ids).first())) return { userId, created, ordersAdded: 0, skipped: null };
  const { added, skipped } = await seedDemoOrders(ctx, userId, demoOrders);
  if (added) await addDemoExtras(ctx, userId, now);
  return { userId, created, ordersAdded: added, skipped };
}

const SAUDI_OFFSET_MS = 3 * 3600_000;
/** `hour:minute` Saudi time, `days` calendar days before `now`. */
function saudiDaysAgo(now, days, hour, minute) {
  const s = new Date(now.getTime() + SAUDI_OFFSET_MS);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate() - days, hour, minute) - SAUDI_OFFSET_MS);
}

/** PDF cart and the two PDF notifications that are not about orders. */
async function addDemoExtras(ctx, userId, now) {
  const [classic, croissant, praline] = await Promise.all(
    [DEMO_PRODUCT_IDS.classic, DEMO_PRODUCT_IDS.croissant, DEMO_PRODUCT_IDS.praline].map((id) => ctx.catalog.getProduct(id, { fresh: true })),
  );
  const cart = await ctx.db('carts').where({ user_id: userId }).first();
  if (classic && croissant && !(cart?.items?.length > 0)) {
    const items = [
      { productId: classic.id, qty: 1, lastPrice: classic.price },
      { productId: croissant.id, qty: 2, lastPrice: croissant.price },
    ];
    await saveCart(ctx.db, userId, { items, promoCode: null }, now);
  }
  const rows = [
    {
      type: 'security',
      title: 'Password updated',
      body: 'Your password was changed successfully.',
      link: { kind: 'password' },
      read: true,
      at: saudiDaysAgo(now, 17, 9, 15),
    },
  ];
  if (praline) {
    rows.push({
      type: 'product',
      title: 'New: Praline Truffle Box',
      body: 'Hazelnut praline truffles are now in the orange gift box.',
      link: { kind: 'product', id: praline.id },
      read: false,
      at: saudiDaysAgo(now, 10, 10, 0),
    });
  }
  await ctx.db('notifications').insert(
    rows.map((n) => ({ id: newId(), user_id: userId, type: n.type, title: n.title, body: n.body, link: JSON.stringify(n.link), read: n.read, created_at: n.at })),
  );
}

/** Product ids of the PDF cart and notification, as the fake ROF names them. */
const DEMO_PRODUCT_IDS = {
  classic: 'a1b2c3d4-0001-4000-8000-000000000001',
  praline: 'a1b2c3d4-0001-4000-8000-000000000002',
  croissant: 'a1b2c3d4-0001-4000-8000-000000000006',
};

/**
 * Links delivered ROF orders to the customer: our order row (lines, totals, address, branch,
 * estimates), a captured card payment and — for the newest one — the "delivered" notification.
 * Status and step times then come from ROF through the normal refresh. Orders ROF does not have are
 * skipped; if ROF cannot be reached, nothing more is tried.
 * @param {{ id: string, orderNumber: number, payment: { brand, last4, transactionId } }[]} demoOrders
 * @returns {{ added: number, skipped: string|null }}
 */
export async function seedDemoOrders(ctx, userId, demoOrders) {
  const home = await listAddresses(ctx.db, userId).first();
  if (!home) return { added: 0, skipped: 'the demo customer has no address' };
  const address = toAddress(home);
  const problems = [];
  const added = [];

  for (const demo of demoOrders) {
    if (await ctx.db('orders').where({ rof_order_id: demo.id }).first()) continue;
    let raw;
    try {
      raw = await ctx.rof.getOrder(demo.id);
    } catch (error) {
      if (!isRofError(error)) throw error;
      if (error.kind !== 'rejected') return { added: added.length, skipped: `could not reach the ROF (${error.message})` };
      problems.push(`KR-${demo.orderNumber} not found in this ROF (${error.message})`);
      continue;
    }
    const snapshot = toOrderSnapshot(raw);
    const items = toOrderItems(raw);
    const products = await Promise.all(items.map((i) => ctx.catalog.getProduct(i.productId, { fresh: true })));
    if (products.some((p) => !p)) {
      problems.push(`KR-${demo.orderNumber} has products this ROF no longer sells`);
      continue;
    }
    const lines = items.map((i, k) => ({ productId: i.productId, name: products[k].name, qty: i.qty, price: products[k].price, image: products[k].images[0] ?? null }));
    const totals = computeTotals(lines, null, { pricesIncludeVat: ctx.config.pricesIncludeVat });
    const createdAt = new Date(snapshot.createdAt);
    const branch = snapshot.branchId ? await ctx.branches.getBranch(snapshot.branchId) : null;
    const est = estimates(createdAt);
    const orderId = newId();

    await ctx.db.transaction(async (trx) => {
      await trx('orders').insert({
        id: orderId,
        user_id: userId,
        rof_order_id: snapshot.rofOrderId,
        rof_order_number: snapshot.orderNumber,
        rof_status: 'Created',
        rof_status_at: createdAt,
        step: 0,
        cancelled: false,
        branch_id: snapshot.branchId,
        branch_name: branch?.name ?? snapshot.branchName,
        distance_km: branch ? roundedDistance(address.location, branch.location) : null,
        address: JSON.stringify(address),
        delivery_phone: home.phone,
        lines: JSON.stringify(lines),
        subtotal: totals.subtotal,
        discount: totals.discount,
        delivery_fee: totals.delivery,
        vat: totals.vat,
        total: totals.total,
        promo_code: null,
        window_start: new Date(est.windowStart),
        window_end: new Date(est.windowEnd),
        estimates: JSON.stringify(est),
        step_times: JSON.stringify({ 0: createdAt.toISOString() }),
        // Already announced in the PDF's history: the refresh below must not notify again.
        notified: JSON.stringify(['out_for_delivery', 'delivered']),
        created_at: createdAt,
        updated_at: createdAt,
      });
      await trx('payments').insert({
        id: newId(),
        user_id: userId,
        order_id: orderId,
        idempotency_key: newId(),
        method: 'card',
        status: 'captured',
        amount: totals.total,
        brand: demo.payment.brand,
        last4: demo.payment.last4,
        transaction_id: demo.payment.transactionId,
        created_at: createdAt,
        updated_at: createdAt,
      });
    });
    const refreshed = await ctx.orders.refresh(await ctx.db('orders').where({ id: orderId }).first());
    added.push({ ...refreshed, branchName: branch?.name ?? snapshot.branchName ?? 'the branch' });
  }

  const newest = added.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (newest) {
    const deliveredAt = newest.step_times?.[3] ? new Date(newest.step_times[3]) : new Date(newest.created_at);
    await ctx.db('notifications').insert({
      id: newId(),
      user_id: userId,
      type: 'delivered',
      title: `Order #KR-${newest.rof_order_number} delivered`,
      body: `Delivered from ${newest.branchName}. Enjoy!`,
      link: JSON.stringify({ kind: 'order', id: newest.id }),
      read: true,
      created_at: deliveredAt,
    });
  }
  return { added: added.length, skipped: problems.length ? problems.join('; ') : null };
}

async function createDemoCustomer(db, { now, hashCost }) {
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
  return userId;
}
