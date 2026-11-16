import { describe, expect, test } from 'vitest';
import { categoryChips, filterProducts, slugify } from './catalog.js';

const product = (over) => ({
  id: over.name,
  description: [],
  details: [],
  subtitle: null,
  ingredients: null,
  categoryName: 'Truffles',
  price: 100,
  ...over,
});
const PRODUCTS = [
  product({ name: 'Truffle Box · Classic', categoryName: 'Truffles', price: 185, ingredients: 'Chocolate, pistachios.' }),
  product({ name: 'Burnt Chocolate Cheesecake', categoryName: 'Cakes', price: 28 }),
  product({ name: 'Cinnamon Roll', categoryName: 'Pastries', price: 22, details: [{ key: 'storage', label: 'Storage', value: 'Serve warm' }] }),
  product({ name: 'Butter Croissant Box', categoryName: 'Pastries', price: 64, description: ['Six flaky croissants.'] }),
];
const names = (list) => list.map((p) => p.name);

describe('categories', () => {
  test('slugs are lower-case words joined by dashes', () => {
    expect(slugify('Truffles')).toBe('truffles');
    expect(slugify('Gift Boxes & Hampers')).toBe('gift-boxes-hampers');
  });

  test('chips start with All, then one per server category', () => {
    expect(categoryChips([{ id: 'c1', name: 'Truffles' }, { id: 'c2', name: 'Cakes' }])).toEqual([
      { id: 'all', label: 'All' },
      { id: 'truffles', label: 'Truffles' },
      { id: 'cakes', label: 'Cakes' },
    ]);
  });
});

describe('filterProducts', () => {
  test('filters by category slug', () => {
    expect(names(filterProducts(PRODUCTS, { category: 'pastries' }))).toEqual(['Cinnamon Roll', 'Butter Croissant Box']);
    expect(filterProducts(PRODUCTS, { category: 'all' })).toHaveLength(4);
  });

  test('searches name, description, ingredients and detail values', () => {
    expect(names(filterProducts(PRODUCTS, { query: 'pistachio' }))).toEqual(['Truffle Box · Classic']);
    expect(names(filterProducts(PRODUCTS, { query: 'flaky' }))).toEqual(['Butter Croissant Box']);
    expect(names(filterProducts(PRODUCTS, { query: 'serve warm' }))).toEqual(['Cinnamon Roll']);
    expect(names(filterProducts(PRODUCTS, { query: '  CHEESE ' }))).toEqual(['Burnt Chocolate Cheesecake']);
  });

  test('sorts by price both ways and by name', () => {
    expect(names(filterProducts(PRODUCTS, { sort: 'price-asc' }))[0]).toBe('Cinnamon Roll');
    expect(names(filterProducts(PRODUCTS, { sort: 'price-desc' }))[0]).toBe('Truffle Box · Classic');
    expect(names(filterProducts(PRODUCTS, { sort: 'name' }))[0]).toBe('Burnt Chocolate Cheesecake');
    expect(names(filterProducts(PRODUCTS, { sort: 'recommended' }))).toEqual(names(PRODUCTS));
  });
});
