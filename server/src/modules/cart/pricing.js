/**
 * Cart pricing — the customer pays the product prices RSOF sends and nothing else: no delivery fee,
 * no VAT line, no promo code (decided 18 Nov 2026). The total is the sum of the lines.
 */

export const round2 = (n) => Math.round(n * 100) / 100;

/** @param {{ price: number, qty: number }[]} lines */
export function computeTotals(lines) {
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  return { count, subtotal, total: subtotal };
}

/**
 * Prices a stored cart against current ROF data.
 * Line warnings: 'unavailable' (gone/inactive) · 'out_of_stock' · 'qty_reduced' (capped at stock) ·
 * 'price_changed' (differs from the price the customer last saw). Unavailable lines are left out of totals.
 * @param {{ items: { productId, qty, lastPrice? }[] }} cart
 * @param {{ getProduct: (id) => Promise<object|null> }} deps
 */
export async function priceCart({ items }, { getProduct }) {
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
  const priced = lines.filter((l) => l.available).map((l) => ({ price: l.product.price, qty: l.qty }));
  return { items: lines, totals: computeTotals(priced) };
}
