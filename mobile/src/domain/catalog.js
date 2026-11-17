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
