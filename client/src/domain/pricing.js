/** Cart pricing (pure). Prices are VAT-inclusive (Saudi VAT 15 %). */

export const VAT_RATE = 0.15;
export const DELIVERY_FEE = 15;

/** Demo promo codes. */
export const PROMO_CODES = {
  KURAAT10: { code: 'KURAAT10', type: 'percent', value: 10, label: '10% off your sweets' },
  WELCOME15: { code: 'WELCOME15', type: 'percent', value: 15, label: '15% off your first order', firstOrderOnly: true },
  FREEDELIVERY: { code: 'FREEDELIVERY', type: 'delivery', value: 0, label: 'Free delivery' },
};

export function findPromo(code) {
  return PROMO_CODES[(code || '').trim().toUpperCase()] || null;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {{productId:string, qty:number}[]} items
 * @param {(id:string)=>{price:number}|undefined} getProduct
 * @param {object|null} promo
 */
export function computeTotals(items, getProduct, promo = null) {
  const lines = items
    .map((item) => {
      const product = getProduct(item.productId);
      if (!product) return null;
      return { ...item, product, lineTotal: round2(product.price * item.qty) };
    })
    .filter(Boolean);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  let discount = 0;
  let delivery = count > 0 ? DELIVERY_FEE : 0;
  if (promo && count > 0) {
    if (promo.type === 'percent') discount = round2((subtotal * promo.value) / 100);
    if (promo.type === 'delivery') delivery = 0;
  }
  const total = round2(subtotal - discount + delivery);
  const vat = round2((total * VAT_RATE) / (1 + VAT_RATE));
  return { lines, count, subtotal, discount, delivery, total, vat };
}
