/**
 * Cart pricing — ROF stores no prices, VAT, fees or promos (guide §6.1, §13), so our backend
 * computes them. Same formula as the client's domain/pricing.js so totals match what screens showed.
 */
import { DELIVERY_FEE, PROMO_CODES, VAT_RATE } from '../../config/business.js';

export const round2 = (n) => Math.round(n * 100) / 100;

export const normalizePromoCode = (code) => (code || '').trim().toUpperCase() || null;
export const findPromo = (code) => PROMO_CODES[normalizePromoCode(code)] || null;

/**
 * @param {{ price: number, qty: number }[]} lines
 * @param {object|null} promo  a PROMO_CODES entry that is valid for this customer
 */
export function computeTotals(lines, promo, { pricesIncludeVat = true, fulfilment = 'delivery' } = {}) {
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  let discount = 0;
  // Branch pickup has no delivery fee (design 2026-11-18 §5.3).
  let delivery = count > 0 && fulfilment !== 'pickup' ? DELIVERY_FEE : 0;
  if (promo && count > 0) {
    if (promo.type === 'percent') discount = round2((subtotal * promo.value) / 100);
    if (promo.type === 'delivery') delivery = 0;
  }
  let total = round2(subtotal - discount + delivery);
  let vat;
  if (pricesIncludeVat) {
    vat = round2((total * VAT_RATE) / (1 + VAT_RATE));
  } else {
    vat = round2(total * VAT_RATE);
    total = round2(total + vat);
  }
  return { count, subtotal, discount, delivery, total, vat };
}

function promoResult(code, isFirstOrder) {
  const normalized = normalizePromoCode(code);
  if (!normalized) return { promo: null, applied: null };
  const promo = PROMO_CODES[normalized];
  if (!promo) return { promo: { code: normalized, label: null, valid: false, error: "This code isn't valid." }, applied: null };
  if (promo.firstOrderOnly && !isFirstOrder) {
    return { promo: { code: promo.code, label: promo.label, valid: false, error: 'This code is for your first order only.' }, applied: null };
  }
  return { promo: { code: promo.code, label: promo.label, valid: true }, applied: promo };
}

/**
 * Prices a stored cart against current ROF data.
 * Line warnings: 'unavailable' (gone/inactive) · 'out_of_stock' · 'qty_reduced' (capped at stock) ·
 * 'price_changed' (differs from the price the customer last saw). Unavailable lines are left out of totals.
 * @param {{ items: { productId, qty, lastPrice? }[], promoCode?: string|null }} cart
 * @param {{ getProduct: (id) => Promise<object|null>, isFirstOrder: boolean, pricesIncludeVat?: boolean, fulfilment?: 'delivery'|'pickup' }} deps
 */
export async function priceCart({ items, promoCode }, { getProduct, isFirstOrder, pricesIncludeVat = true, fulfilment = 'delivery' }) {
  const products = await Promise.all(items.map((i) => getProduct(i.productId)));
  const lines = items.map((item, i) => {
    const product = products[i];
    if (!product) {
      return { productId: item.productId, qty: item.qty, product: null, lineTotal: 0, available: false, maxQuantity: 0, warning: 'unavailable' };
    }
    const summary = { id: product.id, name: product.name, price: product.price, image: product.images[0] ?? null, meta: product.meta };
    if (!product.inStock) {
      return { productId: item.productId, qty: item.qty, product: summary, lineTotal: 0, available: false, maxQuantity: 0, warning: 'out_of_stock' };
    }
    const qty = Math.min(item.qty, product.maxQuantity);
    let warning = null;
    if (qty < item.qty) warning = 'qty_reduced';
    else if (item.lastPrice != null && item.lastPrice !== product.price) warning = 'price_changed';
    return {
      productId: item.productId,
      qty,
      product: summary,
      lineTotal: round2(product.price * qty),
      available: true,
      maxQuantity: product.maxQuantity,
      warning,
    };
  });
  const { promo, applied } = promoResult(promoCode, isFirstOrder);
  const priced = lines.filter((l) => l.available).map((l) => ({ price: l.product.price, qty: l.qty }));
  return { items: lines, promo, totals: computeTotals(priced, applied, { pricesIncludeVat, fulfilment }) };
}
