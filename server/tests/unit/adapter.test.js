import { describe, expect, test } from 'vitest';
import {
  absoluteUrl,
  toBranch,
  toCategory,
  toCreatedOrder,
  toOrderSnapshot,
  toProduct,
  toRofOrderPayload,
  toRofPhone,
  toStockByBranch,
  toTimeline,
} from '../../src/rof/adapter.js';

const BASE = 'http://localhost:8080';

// Fixtures copied from the ROF guide's examples (§4, §5, §9.1, §9.2, §10).
const guideListProduct = {
  id: 'p1',
  name: 'Truffle Box · Classic',
  description: 'Thirty hand-finished truffles.\n\nEvery box is filled by hand.',
  status: 'Active',
  sellingPrice: 185,
  availableToSell: 120,
  allowOversell: false,
  baseUnitName: 'Piece',
  categoryId: 'c1',
  categoryName: 'Truffles',
  customFields: {},
  primaryImageUrl: '/uploads/products/a.jpg',
};
const guideDetailProduct = {
  ...guideListProduct,
  primaryImageUrl: undefined,
  images: [
    { id: 'i2', url: '/uploads/products/b.jpg', isPrimary: false, displayOrder: 1 },
    { id: 'i1', url: '/uploads/products/a.jpg', isPrimary: true, displayOrder: 0 },
  ],
  customFields: { weight_g: 480, pieces: 30 },
  customFieldDefinitions: [{ fieldKey: 'weight_g', label: 'Weight', dataType: 'number', displayOrder: 1 }],
};
const guideBranch = {
  id: 'b1',
  name: 'Al Khobar · Corniche',
  address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952',
  phoneNumber: '+966 13 555 0110',
  latitude: 26.28,
  longitude: 50.21,
  city: 'Al Khobar',
  branchType: 'hub',
  isHubBranch: true,
  isActive: true,
  dailyOrderLimit: 40,
  assignedOrdersToday: 3,
  secondPriorityBranchId: null,
  parentBranchId: null,
};

describe('products', () => {
  test('list product → our shape with absolute primary image and no ROF field names', () => {
    const p = toProduct(guideListProduct, { baseUrl: BASE });
    expect(p).toEqual({
      id: 'p1',
      name: 'Truffle Box · Classic',
      description: ['Thirty hand-finished truffles.', 'Every box is filled by hand.'],
      price: 185,
      categoryId: 'c1',
      categoryName: 'Truffles',
      images: ['http://localhost:8080/uploads/products/a.jpg'],
      inStock: true,
      maxQuantity: 20,
      meta: null,
      subtitle: null,
      badge: null,
      featured: false,
      details: [],
    });
    expect(JSON.stringify(p)).not.toMatch(/sellingPrice|availableToSell|primaryImageUrl|customFields/);
  });

  test('detail product: images primary first, meta "30 pcs · 480 g", detail rows from definitions', () => {
    const p = toProduct(guideDetailProduct, { baseUrl: BASE });
    expect(p.images).toEqual(['http://localhost:8080/uploads/products/a.jpg', 'http://localhost:8080/uploads/products/b.jpg']);
    expect(p.meta).toBe('30 pcs · 480 g');
    expect(p.details).toEqual([{ key: 'weight_g', label: 'Weight', value: '480 g' }]);
  });

  test('subtitle, badge and featured come from their custom fields and are not detail rows', () => {
    const p = toProduct(
      {
        ...guideDetailProduct,
        customFields: { pieces: '30 pcs', weight_g: 480, subtitle: 'Signature gift box', badge: 'New', featured: true, storage: '' },
        customFieldDefinitions: [
          { fieldKey: 'storage', label: 'Storage', dataType: 'text', displayOrder: 2 },
          { fieldKey: 'subtitle', label: 'Subtitle', dataType: 'text', displayOrder: 3 },
          { fieldKey: 'badge', label: 'Badge', dataType: 'text', displayOrder: 4 },
          { fieldKey: 'featured', label: 'Featured', dataType: 'boolean', displayOrder: 5 },
          { fieldKey: 'pieces', label: 'Pieces', dataType: 'text', displayOrder: 1 },
        ],
      },
      { baseUrl: BASE },
    );
    expect(p).toMatchObject({ subtitle: 'Signature gift box', badge: 'New', featured: true, meta: '30 pcs · 480 g' });
    expect(p.details).toEqual([{ key: 'pieces', label: 'Pieces', value: '30 pcs' }]); // empty storage hidden
  });

  test('stock: out of stock unless oversell; max quantity capped by stock and 20', () => {
    expect(toProduct({ ...guideListProduct, availableToSell: 0 }, { baseUrl: BASE })).toMatchObject({ inStock: false, maxQuantity: 0 });
    expect(toProduct({ ...guideListProduct, availableToSell: 3 }, { baseUrl: BASE }).maxQuantity).toBe(3);
    expect(toProduct({ ...guideListProduct, availableToSell: 0, allowOversell: true }, { baseUrl: BASE })).toMatchObject({
      inStock: true,
      maxQuantity: 20,
    });
  });

  test('Inactive products map to null', () => {
    expect(toProduct({ ...guideListProduct, status: 'Inactive' }, { baseUrl: BASE })).toBeNull();
  });
});

describe('other mappings', () => {
  test('absoluteUrl prefixes paths and keeps full URLs', () => {
    expect(absoluteUrl('/uploads/x.png', BASE)).toBe('http://localhost:8080/uploads/x.png');
    expect(absoluteUrl('uploads/x.png', BASE)).toBe('http://localhost:8080/uploads/x.png');
    expect(absoluteUrl('https://cdn.example.com/x.png', BASE)).toBe('https://cdn.example.com/x.png');
    expect(absoluteUrl(null, BASE)).toBeNull();
  });

  test('category', () => {
    expect(toCategory({ id: 'c1', name: 'Truffles', imageUrl: '/uploads/brand-images/x.png' }, { baseUrl: BASE })).toEqual({
      id: 'c1',
      name: 'Truffles',
      imageUrl: 'http://localhost:8080/uploads/brand-images/x.png',
    });
  });

  test('branch drops internal fields and keeps the hub flag', () => {
    const b = toBranch(guideBranch);
    expect(b).toEqual({
      id: 'b1',
      name: 'Al Khobar · Corniche',
      address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952',
      city: 'Al Khobar',
      phone: '+966 13 555 0110',
      location: { lat: 26.28, lng: 50.21 },
      isHub: true,
    });
    expect(toBranch({ ...guideBranch, branchType: 'warehouse' }).isHub).toBe(false);
  });

  test('toRofPhone adds the 966 country code', () => {
    expect(toRofPhone('501234821')).toBe('966501234821');
  });

  test('stock by branch from the inventory reply', () => {
    expect(toStockByBranch([{ branchId: 'b1', branchName: 'x', quantity: 0 }, { branchId: 'b2', quantity: 5 }])).toEqual({ b1: 0, b2: 5 });
  });

  test('created order, order snapshot and timeline', () => {
    expect(toCreatedOrder({ id: 'o1', orderNumber: 20418, status: 'Created' })).toEqual({ rofOrderId: 'o1', orderNumber: 20418, status: 'Created' });
    expect(
      toOrderSnapshot({ id: 'o1', orderNumber: 20418, status: 'Preparing', assignedToBranch: 'b1', assignBranchName: 'Kuraat · X', createdOn: 't0' }),
    ).toEqual({ rofOrderId: 'o1', orderNumber: 20418, status: 'Preparing', branchId: 'b1', branchName: 'Kuraat · X', createdAt: 't0' });
    expect(
      toTimeline([{ statusFrom: 'Created', statusTo: 'AssignedToBranch', statusToLabel: 'Assigned To Branch', createdOn: '2026-11-15T12:21:00Z' }]),
    ).toEqual([{ status: 'AssignedToBranch', at: '2026-11-15T12:21:00Z' }]);
  });
});

describe('order payload for POST /api/orders/manual (guide §7.1, spec §6.7 step 5)', () => {
  const user = { name: 'Sara Al-Mutairi', email: 'sara.m@example.com', phone: '501234821' };
  const address = { line: 'Building 14, King Fahd Rd', district: 'Al Rakah', city: 'Al Khobar', postcode: '34445', landmark: 'Near Al Rakah Park' };
  const items = [
    { productId: 'p1', qty: 1 },
    { productId: 'p2', qty: 2 },
  ];

  test('uses the delivery phone, MobileApp source and Delivery fulfilment', () => {
    expect(toRofOrderPayload({ user, address, deliveryPhone: '501234821', items })).toEqual({
      customerName: 'Sara Al-Mutairi',
      phoneNumber: '966501234821',
      customerEmail: 'sara.m@example.com',
      address: 'Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445',
      city: 'Al Khobar',
      remarks: 'Landmark: Near Al Rakah Park',
      source: 'MobileApp',
      fulfillmentType: 'Delivery',
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 2 },
      ],
    });
  });

  test('a different delivery phone puts the account phone in remarks; no email or landmark is omitted', () => {
    const payload = toRofOrderPayload({ user: { ...user, email: '' }, address: { ...address, landmark: '' }, deliveryPhone: '559876543', items });
    expect(payload.phoneNumber).toBe('966559876543');
    expect(payload.remarks).toBe('Account phone: +966 50 123 4821');
    expect(payload).not.toHaveProperty('customerEmail');
  });
});
