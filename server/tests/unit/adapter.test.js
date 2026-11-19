import { describe, expect, test } from 'vitest';
import {
  provinceFor,
  absoluteUrl,
  toBranch,
  toCategory,
  toCreatedOrder,
  toOrderItems,
  toOrderSnapshot,
  toProduct,
  toRofOrderPayload,
  toRofPhone,
  toStockMap,
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
      highlights: [],
      ingredients: null,
      allergens: [],
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

  test('weight, pieces and dimensions become the three highlight tiles, in that order', () => {
    const p = toProduct(
      { ...guideDetailProduct, customFields: { dimensions: '32 × 14 × 5 cm', pieces: '30 pcs', weight_g: 480 }, customFieldDefinitions: [] },
      { baseUrl: BASE },
    );
    expect(p.highlights).toEqual([
      { label: 'Weight', value: '480 g' },
      { label: 'Pieces', value: '30 pcs' },
      { label: 'Dimensions', value: '32 × 14 × 5 cm' },
    ]);
  });

  test('ingredients and allergens get their own fields and are not detail rows', () => {
    const p = toProduct(
      {
        ...guideDetailProduct,
        customFields: { weight_g: 480, ingredients: 'Chocolate, cream.', allergens: 'Milk, Nuts , ,Soy' },
        customFieldDefinitions: [
          { fieldKey: 'weight_g', label: 'Net weight', dataType: 'number', displayOrder: 1 },
          { fieldKey: 'allergens', label: 'Allergens', dataType: 'text', displayOrder: 2 },
          { fieldKey: 'ingredients', label: 'Ingredients', dataType: 'text', displayOrder: 3 },
        ],
      },
      { baseUrl: BASE },
    );
    expect(p.ingredients).toBe('Chocolate, cream.');
    expect(p.allergens).toEqual(['Milk', 'Nuts', 'Soy']);
    expect(p.details).toEqual([{ key: 'weight_g', label: 'Net weight', value: '480 g' }]);
  });

  test('allergens given as a list are kept as a list, trimmed', () => {
    const p = toProduct({ ...guideListProduct, customFields: { allergens: ['Milk', ' Nuts ', ''] } }, { baseUrl: BASE });
    expect(p.allergens).toEqual(['Milk', 'Nuts']);
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
      type: 'hub',
      isHub: true,
    });
    expect(toBranch({ ...guideBranch, branchType: 'warehouse' })).toMatchObject({ type: 'warehouse', isHub: false });
    expect(toBranch({ ...guideBranch, branchType: ' Master ' })).toMatchObject({ type: 'master', isHub: false });
    expect(toBranch({ ...guideBranch, branchType: undefined }).type).toBe('');
  });

  test('toRofPhone adds the 966 country code', () => {
    expect(toRofPhone('501234821')).toBe('966501234821');
    expect(toRofPhone('+917905793532')).toBe('917905793532'); // other countries: the plus goes, nothing is added
  });

  test('stock map from the balances reply: sellable = available, oversell = unlimited, never negative', () => {
    const rows = [
      { productId: 'p1', branchId: 'b1', onHand: 2, reserved: 2, available: 0, allowOversell: false },
      { productId: 'p1', branchId: 'b2', onHand: 9, reserved: 1, available: 8, allowOversell: false },
      { productId: 'p2', branchId: 'b1', onHand: 0, reserved: 3, available: -3, allowOversell: false },
      { productId: 'p2', branchId: 'b2', onHand: 0, reserved: 0, available: 0, allowOversell: true },
    ];
    expect(toStockMap(rows)).toEqual({ p1: { b1: 0, b2: 8 }, p2: { b1: 0, b2: Number.POSITIVE_INFINITY } });
    expect(toStockMap()).toEqual({});
  });

  test('created order, order snapshot and timeline', () => {
    expect(toCreatedOrder({ id: 'o1', orderNumber: 20418, status: 'Created' })).toEqual({ rofOrderId: 'o1', orderNumber: 20418, status: 'Created' });
    expect(
      toOrderSnapshot({ id: 'o1', orderNumber: 20418, status: 'Preparing', assignedToBranch: 'b1', assignBranchName: 'Kuraat · X', createdOn: 't0' }),
    ).toEqual({ rofOrderId: 'o1', orderNumber: 20418, status: 'Preparing', rawStatus: 'Preparing', branchId: 'b1', branchName: 'Kuraat · X', createdAt: 't0' });
    expect(
      toTimeline([{ statusFrom: 'Created', statusTo: 'AssignedToBranch', statusToLabel: 'Assigned To Branch', createdOn: '2026-11-15T12:21:00Z' }]),
    ).toEqual([{ status: 'AssignedToBranch', at: '2026-11-15T12:21:00Z' }]);
  });

  test('toOrderSnapshot normalises a numeric status (UAT detail / partner API send codes)', () => {
    expect(toOrderSnapshot({ id: 'o', orderNumber: 1001, status: 2 }).status).toBe('SharedLocationManually');
    expect(toOrderSnapshot({ id: 'o', orderNumber: 1001, status: '5' }).status).toBe('Preparing');
  });

  test('toTimeline puts RSOF rows oldest first (RSOF sends them in no order) and keeps a row note', () => {
    const rows = [
      { statusTo: 5, createdOn: '2026-11-15T12:06:00Z', remarks: ' Staff started ' },
      { statusTo: 0, createdOn: '2026-11-15T12:01:00Z' },
      { statusTo: 12, createdOn: '2026-11-15T12:05:00Z', remarks: '' },
    ];
    expect(toTimeline(rows)).toEqual([
      { status: 'Created', at: '2026-11-15T12:01:00Z' },
      { status: 'Canceled', at: '2026-11-15T12:05:00Z' },
      { status: 'Preparing', at: '2026-11-15T12:06:00Z', note: 'Staff started' },
    ]);
  });

  test('toTimeline accepts numeric statusTo', () => {
    expect(toTimeline([{ statusFrom: 0, statusTo: 5, createdOn: 't' }])).toEqual([{ status: 'Preparing', at: 't' }]);
  });

  test('toCreatedOrder normalises a numeric status too', () => {
    expect(toCreatedOrder({ id: 'o1', orderNumber: 1003, status: 0 }).status).toBe('Created');
  });

  test('order items (GET /api/orders/{id} products) → [{ productId, qty }]', () => {
    expect(toOrderItems({ products: [{ productId: 'p1', productName: 'X', quantity: 2 }] })).toEqual([{ productId: 'p1', qty: 2 }]);
    expect(toOrderItems({})).toEqual([]);
  });
});

describe('order payload for POST /api/orders/manual (guide §7.1, spec §6.7 step 5)', () => {
  const user = { name: 'Sara Al-Mutairi', email: 'sara.m@example.com', phone: '501234821' };
  const address = { line: 'Building 14, King Fahd Rd', district: 'Al Rakah', city: 'Al Khobar', postcode: '34445', landmark: 'Near Al Rakah Park' };
  const items = [
    { productId: 'p1', qty: 1 },
    { productId: 'p2', qty: 2 },
  ];

  test('the source says which app placed the order; an unknown channel counts as the mobile app', () => {
    const source = (channel) => toRofOrderPayload({ user, address, deliveryPhone: '501234821', items, channel }).source;
    expect(source('web')).toBe('Website');
    expect(source('mobile')).toBe('MobileApp');
    expect(source(undefined)).toBe('MobileApp');
    expect(source('something-else')).toBe('MobileApp');
  });

  test('uses the delivery phone, MobileApp source and Delivery fulfilment', () => {
    expect(toRofOrderPayload({ user, address, deliveryPhone: '501234821', items })).toEqual({
      customerName: 'Sara Al-Mutairi',
      phoneNumber: '966501234821',
      customerEmail: 'sara.m@example.com',
      address: 'Building 14, King Fahd Rd, Al Rakah, Al Khobar 34445',
      city: 'Al Khobar',
      country: 'Saudi Arabia',
      province: 'Eastern Province',
      remarks: 'Landmark: Near Al Rakah Park',
      source: 'MobileApp',
      fulfillmentType: 'Delivery',
      orderType: 0,
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 2 },
      ],
    });
  });

  test('the order carries the account phone (an old caller passing another delivery phone changes nothing); no email is omitted', () => {
    const payload = toRofOrderPayload({ user: { ...user, email: '' }, address: { ...address, landmark: '' }, deliveryPhone: '559876543', items });
    expect(payload.phoneNumber).toBe('966501234821');
    expect(payload.remarks).toBeNull();
    expect(payload).not.toHaveProperty('customerEmail');
  });

  test('cash on delivery: the amount to collect goes into remarks (design 2026-11-18 §5.2)', () => {
    const payload = toRofOrderPayload({ user, address, deliveryPhone: '501234821', items, payment: { method: 'cod' }, total: 328 });
    expect(payload.remarks).toBe('Landmark: Near Al Rakah Park · Collect SAR 328.00 (cash on delivery)');
  });

  test('card: remarks say it is paid online through the payment link (the order exists before the payment)', () => {
    const payload = toRofOrderPayload({ user, address: { ...address, landmark: '' }, deliveryPhone: '501234821', items, payment: { method: 'card' }, total: 328 });
    expect(payload.remarks).toBe('Card payment online: SAR 328.00 via payment link');
  });

  test('a city we cannot place in a province sends no province', () => {
    const payload = toRofOrderPayload({ user, address: { ...address, city: 'Abha' }, deliveryPhone: '501234821', items });
    expect(payload).not.toHaveProperty('province');
    expect(payload.country).toBe('Saudi Arabia');
  });
});

describe('pickup payload (design 2026-11-18 §5.3)', () => {
  const user = { name: 'Sara Al-Mutairi', email: 'sara.m@example.com', phone: '501234821' };
  const items = [{ productId: 'p1', qty: 1 }];

  test('Pickup fulfilment, a "Branch pickup" address and the amount to collect at the branch', () => {
    const payload = toRofOrderPayload({ user, address: null, city: 'Al Khobar', deliveryPhone: '501234821', items, payment: { method: 'branch' }, total: 313, fulfilment: 'pickup' });
    expect(payload).toMatchObject({
      fulfillmentType: 'Pickup',
      address: 'Branch pickup',
      city: 'Al Khobar',
      country: 'Saudi Arabia',
      province: 'Eastern Province',
      orderType: 0,
      remarks: 'Collect SAR 313.00 (pay at branch)',
    });
  });

  test('pickup paid by card says so; with no city nothing is guessed', () => {
    const payload = toRofOrderPayload({ user, address: null, deliveryPhone: '559876543', items, payment: { method: 'card' }, total: 313, fulfilment: 'pickup' });
    expect(payload.remarks).toBe('Card payment online: SAR 313.00 via payment link');
    expect(payload).not.toHaveProperty('city');
    expect(payload).not.toHaveProperty('province');
  });
});

describe('provinceFor', () => {
  test.each([
    ['Riyadh', 'Riyadh Province'],
    ['Jeddah', 'Makkah Province'],
    ['Makkah', 'Makkah Province'],
    ['Mecca', 'Makkah Province'],
    ['Taif', 'Makkah Province'],
    ['Dammam', 'Eastern Province'],
    ['Al Khobar', 'Eastern Province'],
    ['  al khobar ', 'Eastern Province'],
    ['Khobar', 'Eastern Province'],
    ['Dhahran', 'Eastern Province'],
    ['Jubail', 'Eastern Province'],
    ['Qatif', 'Eastern Province'],
    ['Madinah', 'Madinah Province'],
    ['Medina', 'Madinah Province'],
    ['Abha', null],
    ['', null],
    [null, null],
  ])('%s → %s', (city, province) => {
    expect(provinceFor(city)).toBe(province);
  });
});
