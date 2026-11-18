/**
 * Seed data for the RSOF stand-in used by the tests: the kuraat tenant as RSOF is expected to set it up — the 6 products
 * and 4 categories from the design PDF (copied from client/src/domain/catalog.js), the 6 PDF branches
 * at real coordinates (OpenStreetMap lookups of the road in each address), one non-hub branch to prove
 * the hub filter, and one inactive product to prove it is hidden.
 *
 * IDs are fixed GUIDs so tests, the DB seed and saved carts can refer to them.
 */

export const TENANT_ID = '6f1c2b0a-7a4e-4d2b-9c51-4b2f0e5a1001';

export const CATEGORY_IDS = {
  truffles: 'c0a80001-0000-4000-8000-000000000001',
  cakes: 'c0a80001-0000-4000-8000-000000000002',
  pastries: 'c0a80001-0000-4000-8000-000000000003',
  breakfast: 'c0a80001-0000-4000-8000-000000000004',
};

export const PRODUCT_IDS = {
  classic: 'a1b2c3d4-0001-4000-8000-000000000001',
  praline: 'a1b2c3d4-0001-4000-8000-000000000002',
  cheesecake: 'a1b2c3d4-0001-4000-8000-000000000003',
  cinnamon: 'a1b2c3d4-0001-4000-8000-000000000004',
  pancakes: 'a1b2c3d4-0001-4000-8000-000000000005',
  croissant: 'a1b2c3d4-0001-4000-8000-000000000006',
  inactive: 'a1b2c3d4-0001-4000-8000-000000000007',
};

export const BRANCH_IDS = {
  corniche: 'b7000000-0000-4000-8000-000000000001',
  dhahran: 'b7000000-0000-4000-8000-000000000002',
  dammam: 'b7000000-0000-4000-8000-000000000003',
  hofuf: 'b7000000-0000-4000-8000-000000000004',
  riyadh: 'b7000000-0000-4000-8000-000000000005',
  jeddah: 'b7000000-0000-4000-8000-000000000006',
  warehouse: 'b7000000-0000-4000-8000-000000000007',
};

export const DEFAULT_CREDENTIALS = {
  email: 'kuraat-app@rsof.local',
  password: 'MockRof@2026',
};

const CATEGORIES = [
  { id: CATEGORY_IDS.truffles, name: 'Truffles', imageUrl: null },
  { id: CATEGORY_IDS.cakes, name: 'Cakes', imageUrl: null },
  { id: CATEGORY_IDS.pastries, name: 'Pastries', imageUrl: null },
  { id: CATEGORY_IDS.breakfast, name: 'Breakfast', imageUrl: null },
];

/** Custom fields RSOF's admin would create in product settings (guide §5). */
const FIELD_DEFINITIONS = [
  { fieldKey: 'weight_g', label: 'Net weight', dataType: 'number', displayOrder: 1 },
  { fieldKey: 'pieces', label: 'Pieces', dataType: 'text', displayOrder: 2 },
  { fieldKey: 'dimensions', label: 'Dimensions (L × W × H)', dataType: 'text', displayOrder: 3 },
  { fieldKey: 'shelf_life', label: 'Shelf life', dataType: 'text', displayOrder: 4 },
  { fieldKey: 'storage', label: 'Storage', dataType: 'text', displayOrder: 5 },
  { fieldKey: 'allergens', label: 'Allergens', dataType: 'text', displayOrder: 6 },
  { fieldKey: 'ingredients', label: 'Ingredients', dataType: 'text', displayOrder: 7 },
  { fieldKey: 'subtitle', label: 'Subtitle', dataType: 'text', displayOrder: 8 },
  { fieldKey: 'badge', label: 'Badge', dataType: 'text', displayOrder: 9 },
  { fieldKey: 'featured', label: 'Featured', dataType: 'boolean', displayOrder: 10 },
];

function product({ key, name, category, price, description, images, fields, status = 'Active' }) {
  const categoryName = CATEGORIES.find((c) => c.id === CATEGORY_IDS[category]).name;
  return {
    id: PRODUCT_IDS[key],
    name,
    description: description.join('\n\n'),
    status,
    sellingPrice: price,
    allowOversell: false,
    baseUnitName: 'Piece',
    categoryId: CATEGORY_IDS[category],
    categoryName,
    images: images.map((file, i) => ({
      id: `${PRODUCT_IDS[key].slice(0, -2)}${String(i + 10)}`,
      url: `/uploads/products/${file}.jpg`,
      isPrimary: i === 0,
      displayOrder: i,
    })),
    customFields: fields,
    customFieldDefinitions: FIELD_DEFINITIONS.filter((d) => d.fieldKey in fields),
  };
}

const PRODUCTS = [
  product({
    key: 'classic',
    name: 'Truffle Box · Classic',
    category: 'truffles',
    price: 185,
    description: [
      'Thirty hand-finished truffles in a classic assortment of salted caramel, pistachio praline, white chocolate and milk ganache, set in our signature maroon gift box with a ribbed lid. Made to be shared around the table.',
      'Every box is filled by hand on the morning it is sent. Open the ribbed lid to find three rows of truffles in individual paper cups, ready to serve.',
    ],
    images: ['truffle-box-classic-1', 'truffle-box-classic-2', 'truffle-box-classic-3'],
    fields: {
      weight_g: 480,
      pieces: '30 pcs',
      dimensions: '32 × 14 × 5 cm',
      shelf_life: '21 days',
      storage: '16 – 20 °C, dry place',
      allergens: 'Milk, Nuts, Soy, May contain gluten',
      ingredients: 'Chocolate, cream, butter, sugar, almonds, pistachios, hazelnuts, salted caramel, vanilla.',
      subtitle: 'Signature gift box · Contains milk, nuts',
      featured: true,
    },
  }),
  product({
    key: 'praline',
    name: 'Truffle Box · Praline',
    category: 'truffles',
    price: 185,
    description: [
      'A richer assortment of dark chocolate, hazelnut praline and caramelised nut truffles, presented in the signature orange gift box. A gift that arrives ready to open.',
      'Each truffle is finished by hand with a crisp praline shell, then nested in its own paper cup so the box travels well across the city.',
    ],
    images: ['truffle-box-praline-1', 'truffle-box-praline-2', 'truffle-box-praline-3'],
    fields: {
      weight_g: 480,
      pieces: '30 pcs',
      dimensions: '32 × 14 × 5 cm',
      shelf_life: '21 days',
      storage: '16 – 20 °C, dry place',
      allergens: 'Milk, Nuts, Soy, May contain gluten',
      ingredients: 'Dark chocolate, hazelnut praline, caramelised almonds, cream, butter, sugar, sea salt, vanilla.',
      subtitle: 'Orange gift box · Contains milk, nuts',
      badge: 'New',
    },
  }),
  product({
    key: 'cheesecake',
    name: 'Burnt Chocolate Cheesecake',
    category: 'cakes',
    price: 28,
    description: [
      'A creamy, deeply caramelised cheesecake slice finished with a lattice of dark chocolate. Baked fresh each morning.',
      'Baked at a high heat for its burnt, caramelised top, then rested overnight so the centre stays soft and creamy.',
    ],
    images: ['burnt-chocolate-cheesecake-2', 'burnt-chocolate-cheesecake-1', 'burnt-chocolate-cheesecake-3'],
    fields: {
      weight_g: 160,
      pieces: '1 slice',
      dimensions: '10 × 9 × 5 cm',
      shelf_life: '3 days',
      storage: '2 – 6 °C, refrigerated',
      allergens: 'Milk, Eggs, Gluten',
      ingredients: 'Cream cheese, cream, eggs, sugar, dark chocolate, cocoa, wheat flour, vanilla.',
      subtitle: 'Single slice · Contains milk, eggs, gluten',
    },
  }),
  product({
    key: 'cinnamon',
    name: 'Cinnamon Roll',
    category: 'pastries',
    price: 22,
    description: [
      'A soft, spiralled roll with warm cinnamon and a glossy cream-cheese glaze. Best enjoyed the same day.',
      'Rolled and baked in small batches through the day, then finished with the glaze while still warm.',
    ],
    images: ['cinnamon-roll-2', 'cinnamon-roll-1', 'cinnamon-roll-3'],
    fields: {
      weight_g: 140,
      pieces: '1 pc',
      dimensions: '9 × 9 × 6 cm',
      shelf_life: 'Same day',
      storage: 'Room temperature, covered',
      allergens: 'Milk, Eggs, Gluten',
      ingredients: 'Wheat flour, butter, milk, eggs, sugar, cinnamon, cream cheese, yeast, salt.',
      subtitle: 'Fresh pastry · Contains milk, eggs, gluten',
    },
  }),
  product({
    key: 'pancakes',
    name: 'Berry Pancakes',
    category: 'breakfast',
    price: 36,
    description: [
      'Fluffy buttermilk pancakes served with fresh berries and passion fruit. A slow-morning favourite.',
      'Packed with a pot of maple syrup and whipped butter on the side. Best enjoyed within an hour of delivery.',
    ],
    images: ['berry-pancakes-2', 'berry-pancakes-1', 'berry-pancakes-3'],
    fields: {
      weight_g: 220,
      pieces: '3 pcs',
      dimensions: '20 × 20 × 5 cm',
      shelf_life: 'Same day',
      storage: 'Serve warm',
      allergens: 'Milk, Eggs, Gluten',
      ingredients:
        'Wheat flour, buttermilk, eggs, butter, sugar, strawberries, blueberries, blackberries, passion fruit, maple syrup.',
      subtitle: 'Breakfast · Contains milk, eggs, gluten',
    },
  }),
  product({
    key: 'croissant',
    name: 'Butter Croissant Box',
    category: 'pastries',
    price: 64,
    description: [
      'A box of four laminated pastries: butter croissant, chocolate twist, hazelnut cruffin and a flaky pain au chocolat.',
      'Laminated with cultured butter over three days for a crisp, shattering shell and a soft, honeycombed centre.',
    ],
    images: ['butter-croissant-box-1', 'butter-croissant-box-2', 'butter-croissant-box-3'],
    fields: {
      weight_g: 380,
      pieces: '4 pcs',
      dimensions: '24 × 24 × 7 cm',
      shelf_life: '2 days',
      storage: 'Room temperature, dry place',
      allergens: 'Milk, Eggs, Gluten, Nuts',
      ingredients: 'Wheat flour, butter, milk, eggs, sugar, dark chocolate, hazelnuts, yeast, salt.',
      subtitle: 'Box of 4 · Contains milk, eggs, gluten, nuts',
    },
  }),
  product({
    key: 'inactive',
    name: 'Seasonal Date Truffles',
    category: 'truffles',
    price: 95,
    status: 'Inactive',
    description: ['Medjool date truffles rolled in cocoa — a Ramadan special, not on sale right now.'],
    images: ['truffle-box-classic-2'],
    fields: { weight_g: 250, pieces: '12 pcs' },
  }),
];

const internal = { dailyOrderLimit: 40, assignedOrdersToday: 0, secondPriorityBranchId: null, parentBranchId: null };

function branch(key, { name, address, phoneNumber, city, latitude, longitude, branchType = 'hub' }) {
  return {
    id: BRANCH_IDS[key],
    name,
    address,
    phoneNumber,
    latitude,
    longitude,
    city,
    branchType,
    isHubBranch: branchType === 'hub',
    isActive: true,
    ...internal,
  };
}

const BRANCHES = [
  branch('corniche', {
    name: 'Kuraat · Al Khobar Corniche',
    address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952',
    phoneNumber: '+966 13 555 0110',
    city: 'Al Khobar',
    latitude: 26.305709,
    longitude: 50.227336,
  }),
  branch('dhahran', {
    name: 'Kuraat · Dhahran · King Abdulaziz Rd',
    address: 'King Abdulaziz Rd, Dhahran 34247',
    phoneNumber: '+966 13 555 0120',
    city: 'Dhahran',
    latitude: 26.335411,
    longitude: 50.120579,
  }),
  branch('dammam', {
    name: 'Kuraat · Dammam Al Faisaliyah',
    address: 'Prince Mohammed bin Fahd Rd, Dammam 32245',
    phoneNumber: '+966 13 555 0130',
    city: 'Dammam',
    latitude: 26.405289,
    longitude: 50.113575,
  }),
  branch('hofuf', {
    name: 'Kuraat · Al Ahsa Hofuf',
    address: 'King Abdullah Rd, Hofuf 36362',
    phoneNumber: '+966 13 555 0140',
    city: 'Al Ahsa',
    latitude: 25.369487,
    longitude: 49.546409,
  }),
  branch('riyadh', {
    name: 'Kuraat · Riyadh Olaya',
    address: 'Olaya St, Al Olaya, Riyadh 12611',
    phoneNumber: '+966 11 555 0150',
    city: 'Riyadh',
    latitude: 24.698199,
    longitude: 46.682117,
  }),
  branch('jeddah', {
    name: 'Kuraat · Jeddah Al Rawdah',
    address: 'Prince Sultan Rd, Al Rawdah, Jeddah 23434',
    phoneNumber: '+966 12 555 0160',
    city: 'Jeddah',
    latitude: 21.551929,
    longitude: 39.14359,
  }),
  branch('warehouse', {
    name: 'Kuraat · Dammam Central Kitchen',
    address: '2nd Industrial City, Dammam 34332',
    phoneNumber: '+966 13 555 0190',
    city: 'Dammam',
    latitude: 26.32,
    longitude: 50.03,
    branchType: 'warehouse',
  }),
];

function initialStock() {
  const stock = {};
  for (const p of PRODUCTS) {
    if (p.status !== 'Active') continue;
    stock[p.id] = {};
    for (const b of BRANCHES) if (b.isHubBranch) stock[p.id][b.id] = 50;
  }
  // The PDF's "ships from Dhahran" case: Praline is out of stock at Al Khobar Corniche.
  stock[PRODUCT_IDS.praline][BRANCH_IDS.corniche] = 0;
  return stock;
}

/** A fresh copy of the whole stand-in state: an empty order book, so order counts in a test mean only what the test placed. */
export function createSeed() {
  return structuredClone({
    tenantId: TENANT_ID,
    credentials: DEFAULT_CREDENTIALS,
    categories: CATEGORIES,
    products: PRODUCTS,
    branches: BRANCHES,
    stock: initialStock(),
    orders: [],
    nextOrderNumber: 20418,
    /** Login timestamps within the last minute (rate limit) and the total number of logins. */
    loginLog: [],
    loginCount: 0,
  });
}
