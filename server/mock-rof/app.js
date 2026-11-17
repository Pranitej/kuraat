/**
 * Fake ROF — a local stand-in for the RSOF order system (guide: "Order Integration API Guide –
 * Mobile App Backend"). It implements only the endpoints our backend uses and answers in the
 * guide's documented shapes, including its habit of replying HTTP 200 with success:false.
 *
 * Shapes NOT documented in the guide (assumptions, verify with `npm run rof:check` on UAT):
 * - GET /api/inventory/product/{id} → data: [{ branchId, branchName, quantity }]
 * - POST /api/orders/{id}/resend-otp failure wording
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerOrderRoutes } from './orders.js';

const here = dirname(fileURLToPath(import.meta.url));
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
  app.use('/uploads', express.static(join(here, 'uploads')));

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

  app.get('/api/inventory/product/:id', (req, res) => {
    const stock = db.stock[req.params.id];
    if (!stock) return res.json(fail('Product not found'));
    const rows = Object.entries(stock).map(([branchId, quantity]) => ({
      branchId,
      branchName: db.branches.find((b) => b.id === branchId)?.name ?? null,
      quantity,
    }));
    return res.json(ok(rows));
  });

  /* ---------- branches ---------- */

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
