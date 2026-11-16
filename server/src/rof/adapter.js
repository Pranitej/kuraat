/**
 * ROF → our shapes (and our data → ROF request bodies). Pure functions; the only code outside
 * client.js that knows ROF field names. If UAT's replies differ from the guide, fix them here.
 */
import { MAX_ITEM_QTY } from '../config/business.js';
import { FIELD_MAP, HIGHLIGHTS, PLACEMENT_ONLY_KEYS } from './fields.js';

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
    // Lead's rule: delivery branches are the ones with branchType = 'hub'.
    isHub: String(raw.branchType || '').toLowerCase() === 'hub',
  };
}

/** Optional per-branch stock (guide §6.2; reply shape assumed — see mock-rof/app.js). */
export const toStockByBranch = (rows = []) => Object.fromEntries(rows.map((r) => [r.branchId, Number(r.quantity) || 0]));

/** Our 9-digit local mobile → ROF format (guide §7.1: digits with country code). */
export const toRofPhone = (localPhone) => `966${String(localPhone).replace(/\D/g, '').replace(/^966/, '').replace(/^0/, '')}`;

const formatLocalPhone = (d) => `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;

/** "Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445" */
export function formatAddressLine(address) {
  const cityLine = [address.city, address.postcode].filter((v) => !isBlank(v)).join(' ');
  return [address.line, address.district, cityLine].filter((v) => !isBlank(v)).join(', ');
}

/** Body for POST /api/orders/manual (guide §7.1; design spec §6.7 step 5). */
export function toRofOrderPayload({ user, address, deliveryPhone, items }) {
  const remarks = [];
  if (!isBlank(address.landmark)) remarks.push(`Landmark: ${address.landmark.trim()}`);
  if (deliveryPhone !== user.phone) remarks.push(`Account phone: +966 ${formatLocalPhone(user.phone)}`);
  const payload = {
    customerName: user.name,
    // The delivery code and WhatsApp updates go to this number (guide §7.1).
    phoneNumber: toRofPhone(deliveryPhone),
    customerEmail: isBlank(user.email) ? undefined : user.email,
    address: formatAddressLine(address),
    city: address.city,
    remarks: remarks.length ? remarks.join(' · ') : null,
    source: 'MobileApp',
    fulfillmentType: 'Delivery',
    items: items.map((i) => ({ productId: i.productId, quantity: i.qty })),
  };
  if (payload.customerEmail === undefined) delete payload.customerEmail;
  return payload;
}

/** POST /api/orders/manual reply (guide §7.1). */
export const toCreatedOrder = (raw) => ({ rofOrderId: raw.id, orderNumber: raw.orderNumber, status: raw.status });

/** GET /api/orders/{id} (guide §9.1) → the parts we keep. */
export const toOrderSnapshot = (raw) => ({
  rofOrderId: raw.id,
  orderNumber: raw.orderNumber,
  status: raw.status,
  branchId: raw.assignedToBranch ?? null,
  branchName: raw.assignBranchName ?? null,
  createdAt: raw.createdOn ?? null,
});

/** GET /api/orders/{id} products (guide §9.1) → [{ productId, qty }]. */
export const toOrderItems = (raw) => (raw.products || []).map((p) => ({ productId: p.productId, qty: Number(p.quantity) }));

/** GET /api/orders/{id}/timeline (guide §9.2, oldest first) → [{ status, at }]. */
export const toTimeline = (rows = []) => rows.map((r) => ({ status: r.statusTo, at: r.createdOn }));
