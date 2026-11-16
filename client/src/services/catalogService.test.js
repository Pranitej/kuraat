import { afterEach, expect, test, vi } from 'vitest';
import { stubFetch } from '@/test/stubFetch.js';
import { getProductDetail, listCategories, listProducts } from './catalogService.js';

afterEach(() => vi.unstubAllGlobals());

test('list calls and the full product (with its detail rows) by id', async () => {
  const calls = stubFetch(() => ({ body: [] }));
  await listCategories();
  await listProducts();
  await getProductDetail('a1b2/c3');
  expect(calls.map((c) => c.path)).toEqual(['/categories', '/products', '/products/a1b2%2Fc3']);
});
