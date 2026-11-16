/**
 * Cart display helpers (pure). The server prices the cart; these only merge its answer with taps
 * it has not seen yet and word its warnings.
 */
import { formatSAR } from './format.js';

const BLOCKING = ['unavailable', 'out_of_stock'];

/** Customer-facing text for a server line warning, or null. */
export function lineWarning(line) {
  switch (line.warning) {
    case 'unavailable':
      return 'No longer available. Remove it to continue.';
    case 'out_of_stock':
      return 'Out of stock. Remove it to continue.';
    case 'qty_reduced':
      return `Only ${line.maxQuantity} left, so we changed the quantity.`;
    case 'price_changed':
      return `Price changed to ${formatSAR(line.product.price)}.`;
    default:
      return null;
  }
}

/**
 * Stock wording for a delivery quote: the server says true/false when it checked per-branch stock
 * and null when that check is off (then nothing is claimed — stock is confirmed at order time).
 */
export function quoteStockLabel(inStock) {
  if (inStock === true) return 'In stock';
  if (inStock === false) return 'Limited stock';
  return null;
}

/** Lines that cannot be ordered stop checkout until they are removed. */
export const isCartBlocked = (lines) => lines.some((l) => BLOCKING.includes(l.warning));

const summary = (p) => ({ id: p.id, name: p.name, price: p.price, image: p.images?.[0] ?? null, meta: p.meta ?? null });

/**
 * Lines to show: the local items (in their order, with their quantities) over the server's last
 * priced lines; a product the server has not priced yet comes from the catalogue.
 * @param {{ productId: string, qty: number }[]} items
 * @param {object[]} pricedLines  server cart lines
 * @param {(id: string) => object|null} getProduct  catalogue lookup
 */
export function cartLines(items, pricedLines, getProduct) {
  const priced = new Map(pricedLines.map((l) => [l.productId, l]));
  return items.map(({ productId, qty }) => {
    const server = priced.get(productId);
    if (server) {
      return { ...server, qty, lineTotal: server.available && server.product ? Math.round(server.product.price * qty * 100) / 100 : 0 };
    }
    const product = getProduct(productId);
    if (!product) return { productId, qty, product: null, lineTotal: 0, available: false, maxQuantity: 0, warning: 'unavailable' };
    return {
      productId,
      qty,
      product: summary(product),
      lineTotal: product.inStock ? Math.round(product.price * qty * 100) / 100 : 0,
      available: product.inStock,
      maxQuantity: product.maxQuantity,
      warning: product.inStock ? null : 'out_of_stock',
    };
  });
}
