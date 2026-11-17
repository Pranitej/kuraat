/**
 * Contract check: calls every ROF endpoint we use with the configured service user and compares the
 * replies with what the adapter expects (schemas.js). Run it the day the UAT login arrives
 * (`npm run rof:check`); fix any MISMATCH in adapter.js / fields.js only.
 *
 * --write additionally creates ONE order, assigns it to a hub, reads it and cancels it. On UAT,
 * agree this with RSOF first: it creates a real (cancelled) order in the kuraat tenant.
 */
import { toBranch, toProduct } from './adapter.js';
import { createRofClient } from './client.js';
import { FIELD_MAP } from './fields.js';
import {
  branchSchema,
  branchesSchema,
  categoriesSchema,
  createdOrderSchema,
  inventorySchema,
  orderDetailSchema,
  productDetailSchema,
  productListSchema,
  timelineSchema,
} from './schemas.js';
import { stepOf } from './status.js';

const describeIssues = (issues) =>
  issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');

export async function runRofCheck({ baseUrl, email, password, timeoutMs = 10000, write = false, log = console.log }) {
  const rof = createRofClient({ baseUrl, email, password, timeoutMs });
  let ok = true;
  const line = (status, name, detail = '') => log(`${status.padEnd(9)}${name}${detail ? ` — ${detail}` : ''}`);
  const check = (name, schema, value, note = '') => {
    const result = schema.safeParse(value);
    if (result.success) line('OK', name, note);
    else {
      ok = false;
      line('MISMATCH', name, describeIssues(result.error.issues));
    }
    return result.success;
  };
  const call = async (name, fn) => {
    try {
      return await fn();
    } catch (error) {
      ok = false;
      line('FAIL', name, `${error.kind ?? 'error'}: ${error.message}`);
      return undefined;
    }
  };

  const tenantId = await call('login', () => rof.getTenantId());
  if (!tenantId) return { ok: false };
  line('OK', 'login', `tenant ${tenantId}`);

  const categories = await call('categories', () => rof.listCategories());
  if (categories) check('categories', categoriesSchema, categories.items, `${categories.items.length} categories`);

  const products = await call('products list', () => rof.listProducts());
  let firstActive = null;
  if (products && check('products list', productListSchema, products.items, `${products.totalCount} products`)) {
    firstActive = products.items.find((p) => p.status === 'Active' && (p.availableToSell > 0 || p.allowOversell)) ?? null;
    if (!firstActive) line('WARN', 'products list', 'no active product with stock — the app will show an empty shop');
  }

  if (firstActive) {
    const detail = await call('product detail', () => rof.getProduct(firstActive.id));
    if (detail && check('product detail', productDetailSchema, detail, firstActive.name)) {
      const keys = (detail.customFieldDefinitions || []).map((d) => d.fieldKey);
      const absent = (uses) => uses.filter((use) => !keys.includes(FIELD_MAP[use])).map((use) => `${use}=${FIELD_MAP[use]}`);
      // pieces + weight make the card line ("30 pcs · 480 g"); subtitle/badge/featured are per product.
      const missingCard = absent(['pieces', 'weight']);
      const missingOptional = absent(['subtitle', 'badge', 'featured']);
      line(
        missingCard.length ? 'WARN' : 'OK',
        'custom fields',
        `ROF keys on "${detail.name}": [${keys.join(', ')}]` +
          (missingCard.length ? ` · card line keys not found: ${missingCard.join(', ')} (ask RSOF for the real keys, then update src/rof/fields.js)` : '') +
          (missingOptional.length ? ` · optional, not on this product: ${missingOptional.join(', ')}` : ''),
      );
      if (!toProduct(detail, { baseUrl })) line('WARN', 'product detail', 'adapter hid this product');
    }
    try {
      const inventory = await rof.getProductInventory(firstActive.id);
      check('inventory (assumed shape)', inventorySchema, inventory);
    } catch (error) {
      line('SKIP', 'inventory', `${error.message} — keep ROF_INVENTORY_CHECK=false unless RSOF grants Inventory.Read`);
    }
  }

  const branches = await call('branches', () => rof.listBranches({ hubOnly: true }));
  let hubs = [];
  if (branches && check('branches', branchesSchema, branches.items, `${branches.items.length} returned`)) {
    hubs = branches.items.map(toBranch).filter((b) => b.isHub);
    if (!hubs.length) line('WARN', 'branches', "no branch with branchType 'hub' — orders cannot be assigned");
    const noCoords = hubs.filter((b) => !b.location.lat || !b.location.lng);
    if (noCoords.length) line('WARN', 'branches', `hubs without coordinates: ${noCoords.map((b) => b.name).join(', ')}`);
    if (hubs[0]) {
      const one = await call('branch detail', () => rof.getBranch(hubs[0].id));
      if (one) check('branch detail', branchSchema, one, hubs[0].name);
    }
  }

  if (write && firstActive && hubs.length) {
    const created = await call('order create', () =>
      rof.createOrder({
        customerName: 'kuraat contract check',
        phoneNumber: '966500000000',
        address: 'Contract check — not a real delivery',
        city: hubs[0].city,
        remarks: 'Automated kuraat contract check — safe to ignore; cancelled immediately',
        source: 'MobileApp',
        fulfillmentType: 'Delivery',
        orderType: 0,
        country: 'Saudi Arabia',
        items: [{ productId: firstActive.id, quantity: 1 }],
      }),
    );
    if (created && check('order create', createdOrderSchema, created, `#${created.orderNumber}`)) {
      // We never assign: ROF's auto-assignment picks the branch from the pin (design 2026-11-18 §5.2).
      const pin = hubs[0].location;
      const shared = await call('order pin', () => rof.shareOrderLocation(created.id, pin));
      if (shared !== undefined) line('OK', 'order pin', `${pin.lat}, ${pin.lng}`);
      const afterPin = await call('order detail after pin', () => rof.getOrder(created.id));
      if (afterPin?.assignedToBranch) line('OK', 'order auto-assign', afterPin.assignBranchName || afterPin.assignedToBranch);
      else if (afterPin) line('WARN', 'order auto-assign', `not assigned yet (status ${afterPin.status}) — auto-assignment may be off; staff would assign by hand`);
      const order = await call('order detail', () => rof.getOrder(created.id));
      if (order) check('order detail', orderDetailSchema, order, `status ${order.status}`);
      const timeline = await call('order timeline', () => rof.getOrderTimeline(created.id));
      if (timeline && check('order timeline', timelineSchema, timeline, `${timeline.length} rows`)) {
        const unknown = timeline.map((r) => r.statusTo).filter((s) => stepOf(s) === null);
        if (unknown.length) line('WARN', 'order timeline', `unknown statuses: ${[...new Set(unknown)].join(', ')}`);
      }
      const cancelled = await call('order cancel', () => rof.cancelOrder(created.id));
      if (cancelled !== undefined) line('OK', 'order cancel');
    }
  }

  log(ok ? 'All checks passed.' : 'Some checks failed — see MISMATCH/FAIL lines above.');
  return { ok };
}
