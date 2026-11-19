/**
 * ROF → our shapes (and our data → ROF request bodies). Pure functions; the only code outside
 * client.js that knows ROF field names. If UAT's replies differ from the guide, fix them here.
 */
import { MAX_ITEM_QTY } from '../config/business.js';
import { FIELD_MAP, HIGHLIGHTS, PLACEMENT_ONLY_KEYS } from './fields.js';
import { normalizeStatus, statusInfo } from './status.js';

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Guide §3.4: paths such as /uploads/... need the ROF base URL in front. */
export function absoluteUrl(path, baseUrl) {
  if (isBlank(path)) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

export const toCategory = (raw, { baseUrl }) => ({ id: raw.id, name: raw.name, imageUrl: absoluteUrl(raw.imageUrl, baseUrl) });

function formatFieldValue(key, value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === FIELD_MAP.weight && typeof value === 'number') return `${value} g`;
  if (Array.isArray(value)) return value.join(', ');
  return String(value).trim();
}

/** "Milk, Nuts" or ["Milk", "Nuts"] → ["Milk", "Nuts"] (blanks dropped). */
function listValue(value) {
  if (isBlank(value)) return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map((v) => String(v).trim()).filter(Boolean);
}

function piecesText(value) {
  if (isBlank(value)) return null;
  return typeof value === 'number' ? `${value} pcs` : String(value).trim();
}

function productImages(raw, baseUrl) {
  if (Array.isArray(raw.images) && raw.images.length) {
    return [...raw.images]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((img) => absoluteUrl(img.url, baseUrl))
      .filter(Boolean);
  }
  const primary = absoluteUrl(raw.primaryImageUrl, baseUrl);
  return primary ? [primary] : [];
}

/**
 * Product (guide §4 list item or §5 detail) → our Product, or null when it must be hidden
 * (guide §4: the list also returns Inactive products).
 */
export function toProduct(raw, { baseUrl }) {
  if (!raw || raw.status !== 'Active') return null;
  const fields = raw.customFields || {};
  const available = Number(raw.availableToSell) || 0;
  const oversell = Boolean(raw.allowOversell);

  const pieces = piecesText(fields[FIELD_MAP.pieces]);
  const weight = isBlank(fields[FIELD_MAP.weight]) ? null : formatFieldValue(FIELD_MAP.weight, fields[FIELD_MAP.weight]);
  const meta = [pieces, weight].filter(Boolean).join(' · ') || null;

  const details = [...(raw.customFieldDefinitions || [])]
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .filter((d) => !PLACEMENT_ONLY_KEYS.includes(d.fieldKey) && !isBlank(fields[d.fieldKey]))
    .map((d) => ({ key: d.fieldKey, label: d.label, value: formatFieldValue(d.fieldKey, fields[d.fieldKey]) }));

  return {
    id: raw.id,
    name: raw.name,
    description: String(raw.description || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    price: Number(raw.sellingPrice),
    categoryId: raw.categoryId ?? null,
    categoryName: raw.categoryName ?? null,
    images: productImages(raw, baseUrl),
    inStock: oversell || available > 0,
    maxQuantity: oversell ? MAX_ITEM_QTY : Math.max(0, Math.min(MAX_ITEM_QTY, available)),
    meta,
    subtitle: isBlank(fields[FIELD_MAP.subtitle]) ? null : String(fields[FIELD_MAP.subtitle]).trim(),
    badge: isBlank(fields[FIELD_MAP.badge]) ? null : String(fields[FIELD_MAP.badge]).trim(),
    featured: fields[FIELD_MAP.featured] === true || fields[FIELD_MAP.featured] === 'true',
    highlights: HIGHLIGHTS.filter((h) => !isBlank(fields[h.key])).map((h) => ({
      label: h.label,
      value: h.key === FIELD_MAP.pieces ? piecesText(fields[h.key]) : formatFieldValue(h.key, fields[h.key]),
    })),
    ingredients: isBlank(fields[FIELD_MAP.ingredients]) ? null : String(fields[FIELD_MAP.ingredients]).trim(),
    allergens: listValue(fields[FIELD_MAP.allergens]),
    details,
  };
}

/** Branch (guide §10) → ours. Internal fields (dailyOrderLimit, …) are dropped on purpose. */
export function toBranch(raw) {
  return {
    id: raw.id,
    name: raw.name,
    address: raw.address ?? '',
    city: raw.city ?? '',
    phone: raw.phoneNumber ?? '',
    location: { lat: Number(raw.latitude), lng: Number(raw.longitude) },
    // RSOF's own branch type, as it sends it (lower case): 'hub' and 'master' on the UAT. Shown on the branch card.
    type: String(raw.branchType || '').trim().toLowerCase(),
    // Lead's rule: delivery branches are the ones with branchType = 'hub'.
    isHub: String(raw.branchType || '').toLowerCase() === 'hub',
  };
}

/**
 * Stock balances from GET /api/inventory/balances (one row per product × branch, verified on UAT) →
 * { productId: { branchId: sellable } }. Sellable is `available` (on hand minus reserved), or
 * unlimited when the row allows overselling. A product/branch pair with no row holds none.
 */
export function toStockMap(rows = []) {
  const map = {};
  for (const row of rows) {
    const sellable = row.allowOversell === true ? Number.POSITIVE_INFINITY : Math.max(0, Number(row.available) || 0);
    (map[row.productId] ||= {})[row.branchId] = sellable;
  }
  return map;
}

/** Our 9-digit local mobile → ROF format (guide §7.1: digits with country code). */
// Saudi numbers are stored as 9 digits (966 is added); every other country is stored as "+<country code><number>" (the plus goes).
export const toRofPhone = (phone) =>
  String(phone).startsWith('+') ? String(phone).slice(1).replace(/\D/g, '') : `966${String(phone).replace(/\D/g, '').replace(/^966/, '').replace(/^0/, '')}`;

/** "Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445" */
export function formatAddressLine(address) {
  const cityLine = [address.city, address.postcode].filter((v) => !isBlank(v)).join(' ');
  return [address.line, address.district, cityLine].filter((v) => !isBlank(v)).join(', ');
}

const PROVINCES = {
  'Riyadh Province': ['riyadh'],
  'Makkah Province': ['jeddah', 'makkah', 'mecca', 'taif'],
  'Eastern Province': ['dammam', 'al khobar', 'khobar', 'dhahran', 'jubail', 'qatif'],
  'Madinah Province': ['madinah', 'medina'],
};

/** ROF's create body takes a province (lead's collection); null for a city we cannot place. */
export function provinceFor(city) {
  const key = String(city ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  return Object.keys(PROVINCES).find((p) => PROVINCES[p].includes(key)) ?? null;
}

/** What the branch must collect, for ROF's remarks (ROF stores no payments). */
function moneyRemark(payment, total) {
  if (!payment) return null;
  if (payment.method === 'cod') return `Collect SAR ${Number(total).toFixed(2)} (cash on delivery)`;
  // The order is created BEFORE the customer pays on RSOF's payment page (19 Nov 2026): RSOF holds the payment.
  if (payment.method === 'card') return `Online payment: SAR ${Number(total).toFixed(2)} via payment link`;
  if (payment.method === 'branch') return `Collect SAR ${Number(total).toFixed(2)} (pay at branch)`;
  return null;
}

/**
 * ROF's `source` is a free label staff see on the order (guide §7.1: default "Manual", "MobileApp" for
 * the app). Verified on UAT 18 Nov 2026: any text is accepted and stored as sent, so the website gets
 * its own label instead of looking like a phone order.
 */
export const ROF_SOURCE = { mobile: 'MobileApp', web: 'Website' };

/**
 * Body for POST /api/orders/manual (guide §7.1; design 2026-11-18 §5.2). orderType 0 = a normal
 * customer order (ItemOrder — RSOF's default, sent explicitly). `channel` says which of our apps
 * placed it ('web' | 'mobile'); anything else is treated as the mobile app.
 */
export function toRofOrderPayload({ user, address, items, payment = null, total = null, fulfilment = 'delivery', city = null, channel = 'mobile' }) {
  const pickup = fulfilment === 'pickup';
  const remarks = [];
  if (!pickup && !isBlank(address.landmark)) remarks.push(`Landmark: ${address.landmark.trim()}`);
  const money = moneyRemark(payment, total);
  if (money) remarks.push(money);
  // A pickup order has no street address: ROF still wants one, so it gets a plain label (and the
  // customer's usual city when we know it, which also gives the province).
  const orderCity = pickup ? city : address.city;
  const payload = {
    customerName: user.name,
    // The delivery code and WhatsApp updates go to this number (guide §7.1).
    phoneNumber: toRofPhone(user.phone), // the order carries the account's number: RSOF finds a customer's orders by it
    customerEmail: isBlank(user.email) ? undefined : user.email,
    address: pickup ? 'Branch pickup' : formatAddressLine(address),
    city: isBlank(orderCity) ? undefined : orderCity,
    country: 'Saudi Arabia',
    province: provinceFor(orderCity) ?? undefined,
    remarks: remarks.length ? remarks.join(' · ') : null,
    source: ROF_SOURCE[channel] ?? ROF_SOURCE.mobile,
    fulfillmentType: pickup ? 'Pickup' : 'Delivery',
    orderType: 0,
    items: items.map((i) => ({ productId: i.productId, quantity: i.qty })),
  };
  for (const key of ['customerEmail', 'city', 'province']) if (payload[key] === undefined) delete payload[key];
  return payload;
}

/** POST /api/orders/manual reply (guide §7.1). Statuses may come as names or ROF codes. */
export const toCreatedOrder = (raw) => ({ rofOrderId: raw.id, orderNumber: raw.orderNumber, status: normalizeStatus(raw.status) });

/** GET /api/orders/{id} (guide §9.1) → the parts we keep. */
export const toOrderSnapshot = (raw) => ({
  rofOrderId: raw.id,
  orderNumber: raw.orderNumber,
  status: normalizeStatus(raw.status),
  // What ROF actually sent (for the log when the status above is unknown → null).
  rawStatus: raw.status ?? null,
  branchId: raw.assignedToBranch ?? null,
  branchName: raw.assignBranchName ?? null,
  createdAt: raw.createdOn ?? null,
});

/** GET /api/orders/{id} products (guide §9.1) → [{ productId, qty }]. */
export const toOrderItems = (raw) => (raw.products || []).map((p) => ({ productId: p.productId, qty: Number(p.quantity) }));

/** GET /api/orders/{id}/timeline (guide §9.2, oldest first) → [{ status, at }]. */
// RSOF does not promise an order (verified on UAT: the embedded timeline came back shuffled), so rows are put
// oldest first here. A row's remark (RSOF's own note for that change) is kept when there is one.
const timeValue = (at) => Date.parse(at) || 0;
export const toTimeline = (rows = []) =>
  rows
    .map((r) => ({ status: normalizeStatus(r.statusTo), at: r.createdOn, ...(r.remarks && String(r.remarks).trim() ? { note: String(r.remarks).trim() } : {}) }))
    .sort((a, b) => timeValue(a.at) - timeValue(b.at));

/** GET /api/orders/by-phone/{phone} (guide §8) → the RSOF order ids, newest first. The rest of that reply is too thin to show. */
export const toPhoneOrderIds = (rows) => (Array.isArray(rows) ? rows : []).map((r) => r?.orderId).filter(Boolean);

/**
 * GET /api/orders/{id} → everything the orders page shows, straight from RSOF. Prices are the ones
 * RSOF stamped on the lines; RSOF has no VAT, delivery fee, discount or payment, so none are made up.
 * Its embedded timeline has the same shape as /timeline (statusTo, createdOn), so one call is enough.
 */
export function toOrderDetail(raw) {
  const total = raw.productsTotal?.amount;
  const timeline = toTimeline(raw.timeline);
  // A status we do not know (e.g. a transfer code) or a blank one: show the latest status in RSOF's own
  // timeline that we do know, so the order keeps its last step and label.
  const reported = normalizeStatus(raw.status);
  const unknownStatus = statusInfo(reported) === null;
  const status = unknownStatus ? (timeline.findLast((r) => statusInfo(r.status))?.status ?? reported) : reported;
  return {
    rofOrderId: raw.id,
    orderNumber: raw.orderNumber,
    status,
    rawStatus: unknownStatus ? (raw.status ?? null) : null,
    phone: String(raw.phoneNumber ?? '').replace(/\D/g, ''),
    fulfilment: String(raw.fulfillmentType ?? '').toLowerCase() === 'pickup' ? 'pickup' : 'delivery',
    address: raw.address ?? '',
    city: raw.city ?? '',
    branchId: raw.assignedToBranch ?? null,
    branchName: raw.assignBranchName ?? null,
    createdAt: raw.createdOn ?? null,
    lines: (raw.products || []).map((p) => ({
      productId: p.productId,
      name: p.productName ?? '',
      qty: Number(p.quantity),
      price: p.unitPrice ?? null,
    })),
    total: total === undefined || total === null ? null : Number(total),
    timeline,
  };
}

/**
 * RSOF's payment-link answer (rof/paymentLink.js) → ours. The link is opened in the customer's browser, so it
 * must be a web page RSOF serves: https, or on the RSOF address itself (local tests run on http). Anything
 * else is treated as no link at all.
 * @returns {{ outcome: string, link: string|null, expiresAt: string|null, amount: number|null, currency: string|null, reused: boolean }}
 */
export function toPaymentLink(raw, { baseUrl }) {
  let link = null;
  if (raw.outcome === 'LinkReady' && !isBlank(raw.paymentLink)) {
    try {
      const url = new URL(String(raw.paymentLink));
      const rsof = new URL(baseUrl);
      if (url.protocol === 'https:' || url.origin === rsof.origin) link = url.toString();
    } catch {
      link = null;
    }
  }
  return {
    outcome: raw.outcome,
    link,
    expiresAt: isBlank(raw.expiresAt) ? null : String(raw.expiresAt),
    amount: raw.amount === undefined || raw.amount === null ? null : Number(raw.amount),
    currency: isBlank(raw.currency) ? null : String(raw.currency),
    reused: Boolean(raw.reused),
  };
}
