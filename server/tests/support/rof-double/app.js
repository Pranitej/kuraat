/**
 * RSOF stand-in for the automated tests ONLY. It runs inside the test process (tests/helpers/mockRof.js) and is
 * never started as a server: the app and the dev stack talk to the real RSOF. Automated tests must not call a
 * shared RSOF, because they would create real orders there. It implements only the endpoints our backend uses and
 * answers in the shapes of the integration guide and the real UAT, including RSOF's habit of replying HTTP 200
 * with success:false.
 *
 * Shapes NOT documented in the guide: GET /api/inventory/balances and GET /api/branches were verified on
 * the real UAT (18 Nov 2026) and are copied from it. Still an assumption (verify with `npm run rof:check`):
 * - POST /api/orders/{id}/resend-otp failure wording
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import { registerOrderRoutes } from './orders.js';

const LOGINS_PER_MINUTE = 5;

const ok = (data, message = 'Success') => ({ success: true, message, data });
const fail = (message) => ({ success: false, message });

function page(items, query, defaultSize = 20) {
  const pageNumber = Math.max(1, Number(query.PageIndex) || 1);
  const pageSize = Math.max(1, Number(query.PageSize) || defaultSize);
  const start = (pageNumber - 1) * pageSize;
  return { success: true, message: 'Success', totalCount: items.length, pageNumber, pageSize, data: items.slice(start, start + pageSize) };
}

export function createMockRof({ store, now = () => new Date(), tokenSecret = 'mock-rof-secret', tokenTtlSec = 3600 } = {}) {
  const db = store.data;
  const nowSec = () => Math.floor(now().getTime() / 1000);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // Dev-only fault injection (POST /__dev/faults): simulate ROF being down or slow.
  // createOrderReject: a message → order create answers success:false with it.
  app.locals.faults = { down: false, createOrderDelayMs: 0, createOrderReject: null, locationReject: null };
  app.use('/api', (req, res, next) => (app.locals.faults.down ? res.status(503).json(fail('Service unavailable')) : next()));

  /* ---------- auth ---------- */

  app.post('/api/auth/login', (req, res) => {
    const t = now().getTime();
    db.loginLog = db.loginLog.filter((at) => t - at < 60_000);
    if (db.loginLog.length >= LOGINS_PER_MINUTE) return res.status(429).json(fail('Too many login attempts'));
    db.loginLog.push(t);
    db.loginCount = (db.loginCount || 0) + 1;
    const { email, password } = req.body || {};
    if (email !== db.credentials.email || password !== db.credentials.password) {
      return res.json(fail('Invalid email or password'));
    }
    const iat = nowSec();
    const token = jwt.sign({ sub: email, tenantId: db.tenantId, iat, exp: iat + tokenTtlSec }, app.locals.tokenSecret);
    return res.json(ok({ token, tenantId: db.tenantId }));
  });

  /* ---------- payment links (lead's note, 19 Nov 2026 — X-Api-Key, not the Bearer login) ---------- */

  // Shapes from the lead's note; NOT verified on UAT yet (the endpoint answered 404 there on 19 Nov 2026).
  // faults.paymentOutcome: 'NotReady' | 'Error' | … → that outcome; faults.paymentLinkHttp: an HTTP status to answer with.
  app.post('/api/v1/orders/payment-link', (req, res) => {
    if (req.get('x-api-key') !== db.apiKey) return res.status(401).json(fail('Invalid API key'));
    db.paymentLinkCalls = (db.paymentLinkCalls || 0) + 1;
    if (app.locals.faults.paymentLinkHttp) return res.status(app.locals.faults.paymentLinkHttp).json(fail('Payment service error'));
    const answer = (outcome, message, extra = {}) =>
      res.json({
        success: outcome === 'LinkReady' || outcome === 'AlreadyPaid',
        message,
        data: { outcome, orderNumber: Number(req.body?.orderNumber), amount: null, currency: 'SAR', paymentLink: null, expiresAt: null, reused: false, orders: null, message, ...extra },
      });
    if (app.locals.faults.paymentOutcome) return answer(app.locals.faults.paymentOutcome, 'Not available right now.');
    const order = db.orders.find((o) => o.orderNumber === Number(req.body?.orderNumber));
    if (!order || order.phoneNumber !== String(req.body?.phone ?? '')) return answer('NoPayableOrder', 'No payable order matches this order number and phone.');
    db.paymentLinks = db.paymentLinks || {};
    const state = (db.paymentLinks[order.orderNumber] ||= { paid: false, token: null, expiresAt: 0 });
    const amount = order.items.reduce((sum, i) => sum + (db.products.find((p) => p.id === i.productId)?.sellingPrice ?? 0) * i.quantity, 0);
    // Assumed: a paid order stays 'AlreadyPaid' even once cancelled (tests also cover RSOF answering NoPayableOrder then).
    if (state.paid) return answer('AlreadyPaid', 'Order is already paid.', { amount });
    if (order.status === 'Canceled') return answer('NoPayableOrder', 'No payable order matches this order number and phone.');
    const reused = Boolean(state.token) && state.expiresAt > now().getTime();
    if (!reused) {
      state.token = randomUUID().replace(/-/g, '');
      state.expiresAt = now().getTime() + 60 * 60_000; // RSOF: a payment link is valid for 1 hour
    }
    store.save();
    return answer('LinkReady', reused ? 'Payment link reused.' : 'Payment link created.', {
      amount,
      paymentLink: `${req.protocol}://${req.get('host')}/en/pay/${state.token}`,
      expiresAt: new Date(state.expiresAt).toISOString(),
      reused,
    });
  });

  /** Plays the customer paying on RSOF's page (dev-only; never exists in real ROF). */
  app.post('/__dev/orders/:orderNumber/pay', (req, res) => {
    db.paymentLinks = db.paymentLinks || {};
    const state = (db.paymentLinks[Number(req.params.orderNumber)] ||= { paid: false, token: null, expiresAt: 0 });
    state.paid = true;
    res.json({ orderNumber: Number(req.params.orderNumber), paid: true });
  });

  app.use('/api', (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    try {
      if (!token) throw new Error('missing');
      jwt.verify(token, app.locals.tokenSecret, { clockTimestamp: nowSec() });
      return next();
    } catch {
      return res.status(401).json(fail('Unauthorized'));
    }
  });
  app.locals.tokenSecret = tokenSecret;

  /* ---------- catalogue ---------- */

  const availableToSell = (productId) => Object.values(db.stock[productId] || {}).reduce((s, q) => s + q, 0);

  const listView = (p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    sellingPrice: p.sellingPrice,
    availableToSell: availableToSell(p.id),
    allowOversell: p.allowOversell,
    baseUnitName: p.baseUnitName,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    customFields: p.customFields,
    primaryImageUrl: (p.images.find((i) => i.isPrimary) || p.images[0])?.url ?? null,
  });

  const detailView = (p) => {
    const { primaryImageUrl, ...rest } = listView(p);
    return { ...rest, primaryImageUrl, images: p.images, customFieldDefinitions: p.customFieldDefinitions };
  };

  app.get('/api/category/all', (req, res) => res.json(page(db.categories, req.query, 100)));

  app.get('/api/products', (req, res) => {
    const q = String(req.query.Search || '').trim().toLowerCase();
    const categoryId = req.query.CategoryId;
    const items = db.products
      .filter((p) => !categoryId || p.categoryId === categoryId)
      .filter((p) => !q || `${p.name} ${p.description}`.toLowerCase().includes(q))
      .map(listView);
    res.json(page(items, req.query));
  });

  app.get('/api/products/:id', (req, res) => {
    const p = db.products.find((x) => x.id === req.params.id);
    res.json(p ? ok(detailView(p)) : fail('Product not found'));
  });

  // The real shape (verified on UAT): one row per product × branch that has a stock record, 10 per page.
  app.get('/api/inventory/balances', (req, res) => {
    const productId = req.query.ProductId;
    const rows = db.products
      .filter((p) => !productId || p.id === productId)
      .flatMap((p) =>
        Object.entries(db.stock[p.id] || {}).map(([branchId, quantity]) => {
          const branch = db.branches.find((b) => b.id === branchId);
          return {
            id: `${p.id}:${branchId}`,
            tenantId: db.tenantId,
            branchId,
            branchName: branch?.name ?? null,
            branchType: branch?.branchType ?? null,
            productId: p.id,
            productName: p.name,
            baseUnitName: p.baseUnitName,
            packSizes: [],
            onHand: quantity,
            reserved: 0,
            available: quantity,
            incoming: 0,
            allowOversell: p.allowOversell,
            modifiedOn: now().toISOString(),
          };
        }),
      );
    res.json(page(rows, req.query, 10));
  });

  /* ---------- branches ---------- */

  // The lead's GET /api/branches: like the real one it IGNORES isHubBranch, lists every branch
  // (the master too, and closed ones — the client filters those) and answers 10 per page unless asked for more.
  app.get('/api/branches', (req, res) => {
    const q = String(req.query.Search || '').trim().toLowerCase();
    const items = db.branches
      .filter((b) => !q || `${b.name} ${b.city} ${b.phoneNumber} ${b.address}`.toLowerCase().includes(q))
      .map((b) => ({ isDeleted: false, ...b }));
    res.json(page(items, req.query, 10));
  });

  app.get('/api/branches/tenant/:tenantId', (req, res) => {
    if (req.params.tenantId !== db.tenantId) return res.json(fail('Tenant not found'));
    const q = String(req.query.Search || '').trim().toLowerCase();
    const hubOnly = String(req.query.isHubBranch || '').toLowerCase() === 'true';
    const items = db.branches
      .filter((b) => b.isActive)
      .filter((b) => !hubOnly || b.isHubBranch)
      .filter((b) => !q || `${b.name} ${b.city} ${b.phoneNumber} ${b.address}`.toLowerCase().includes(q));
    return res.json({ ...ok(items), totalCount: items.length });
  });

  app.get('/api/branches/:id', (req, res) => {
    const b = db.branches.find((x) => x.id === req.params.id);
    res.json(b ? ok(b) : fail('Branch not found'));
  });

  /* ---------- orders + dev controls ---------- */

  const orders = registerOrderRoutes(app, { store, now, ok, fail, availableToSell });
  app.locals.advanceAll = orders.advanceAll;

  app.use((req, res) => res.status(404).json(fail('Not found')));
  return app;
}
