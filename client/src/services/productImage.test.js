import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { stubFetch } from '@/test/stubFetch.js';
import { clearProductImages, loadProductImage } from './productImage.js';

beforeEach(() => clearProductImages());
afterEach(() => vi.unstubAllGlobals());

describe('loadProductImage', () => {
  test('is the first photo of the product-by-id answer', async () => {
    const calls = stubFetch(() => ({ body: { id: 'p1', images: ['https://rsof.example/a.jpg', 'https://rsof.example/b.jpg'] } }));
    expect(await loadProductImage('p1')).toBe('https://rsof.example/a.jpg');
    expect(calls.map((c) => c.path)).toEqual(['/products/p1']);
  });

  test('asks once for a product however many cards want its photo', async () => {
    const calls = stubFetch(() => ({ body: { id: 'p1', images: ['https://rsof.example/a.jpg'] } }));
    await Promise.all([loadProductImage('p1'), loadProductImage('p1'), loadProductImage('p1')]);
    await loadProductImage('p1');
    expect(calls).toHaveLength(1);
  });

  test('a product RSOF no longer has gives null, and the answer is remembered', async () => {
    const calls = stubFetch(() => ({ status: 404, body: { code: 'not_found', message: 'We could not find that.' } }));
    expect(await loadProductImage('gone')).toBeNull();
    expect(await loadProductImage('gone')).toBeNull();
    expect(calls).toHaveLength(1);
  });

  test('a product with no photo gives null', async () => {
    stubFetch(() => ({ body: { id: 'p2', images: [] } }));
    expect(await loadProductImage('p2')).toBeNull();
  });

  test('a failed lookup gives null but is tried again next time', async () => {
    let failing = true;
    const calls = stubFetch(() => (failing ? { status: 503, body: { code: 'rof_unavailable', message: 'x' } } : { body: { id: 'p3', images: ['https://rsof.example/c.jpg'] } }));
    expect(await loadProductImage('p3')).toBeNull();
    failing = false;
    expect(await loadProductImage('p3')).toBe('https://rsof.example/c.jpg');
    expect(calls).toHaveLength(2);
  });

  test('no product id → null without asking', async () => {
    const calls = stubFetch(() => ({ body: {} }));
    expect(await loadProductImage(undefined)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
