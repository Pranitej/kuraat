/**
 * Catalogue from ROF (guide §4 Home, §5 Product detail), in our shapes, with a short cache.
 * The whole active list is fetched once per minute and filtered here, so Home, search and category
 * chips cost ROF one call instead of one per keystroke.
 */
import { createTtlCache } from '../../lib/cache.js';
import { toCategory, toProduct } from '../../rof/adapter.js';
import { isRofError } from '../../rof/errors.js';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export function createCatalogService({ rof, baseUrl, now = () => Date.now(), ttlMs = 60_000, logger = console }) {
  const cache = createTtlCache({ ttlMs, now });

  async function allProducts() {
    const items = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await rof.listProducts({ pageIndex: page, pageSize: PAGE_SIZE });
      items.push(...result.items);
      if (items.length >= result.totalCount || result.items.length < PAGE_SIZE) break;
    }
    return items.map((raw) => toProduct(raw, { baseUrl })).filter(Boolean);
  }

  return {
    async listCategories() {
      return cache.get('categories', async () => (await rof.listCategories()).items.map((raw) => toCategory(raw, { baseUrl })));
    },

    async listProducts({ categoryId, search } = {}) {
      const products = await cache.get('products', allProducts);
      const q = (search || '').trim().toLowerCase();
      return products
        .filter((p) => !categoryId || p.categoryId === categoryId)
        .filter((p) => !q || [p.name, p.categoryName, p.subtitle, ...p.description].join(' ').toLowerCase().includes(q));
    },

    /** Active product by id, or null (unknown or Inactive). `fresh` bypasses the cache (cart, checkout). */
    async getProduct(id, { fresh = false } = {}) {
      return cache.get(
        `product:${id}`,
        async () => {
          try {
            return toProduct(await rof.getProduct(id), { baseUrl });
          } catch (error) {
            if (isRofError(error, 'rejected')) {
              logger.info(`[catalog] ROF has no active product ${id}: ${error.message}`);
              return null;
            }
            throw error;
          }
        },
        { fresh },
      );
    },
  };
}
