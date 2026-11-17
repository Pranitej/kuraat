/**
 * Catalogue helpers for the server's products (server/README.md → Shop). Pure: search, category
 * chips and sorting run on the list the app already loaded.
 */

export const SORT_OPTIONS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'name', label: 'Name: A to Z' },
];

/** "Gift Boxes & Hampers" → "gift-boxes-hampers" (used in the ?category= URL). */
export function slugify(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/[\s-]+/g, '-');
}

/** Chips for the Home screen: All, then the server's categories in their order. */
export function categoryChips(categories = []) {
  return [{ id: 'all', label: 'All' }, ...categories.map((c) => ({ id: slugify(c.name), label: c.name }))];
}

/**
 * Category pills (design 2026-11-18 §5.5): shown only when the loaded catalogue has products and
 * every one of them has a category; then All + the categories in use, in the server's order.
 * Otherwise no pills and no category filter at all.
 */
export function categoryFilter(products = [], categories = []) {
  const named = (p) => typeof p.categoryName === 'string' && p.categoryName.trim() !== '';
  if (!products.length || !products.every(named)) return { show: false, chips: [] };
  const used = new Set(products.map((p) => p.categoryName.trim()));
  return { show: true, chips: categoryChips(categories.filter((c) => used.has(c.name))) };
}

const searchText = (p) =>
  [p.name, p.categoryName, p.subtitle, ...(p.description || []), p.ingredients, ...(p.details || []).map((d) => d.value)]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/** Search + category (slug) + sort. "recommended" keeps the server's order. */
export function filterProducts(products, { query = '', category = 'all', sort = 'recommended' } = {}) {
  const q = query.trim().toLowerCase();
  let list = products.filter((p) => category === 'all' || slugify(p.categoryName || '') === category);
  if (q) list = list.filter((p) => searchText(p).includes(q));
  const sorted = [...list];
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}
