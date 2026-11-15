/**
 * Product catalogue — the 6 demo products from PDF page 2 (names, prices, weights, dimensions and
 * the first description paragraph are verbatim). Product images are referenced by key; each app
 * resolves keys to its own image sources (web: src/assets/images.js).
 */

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'truffles', label: 'Truffles' },
  { id: 'cakes', label: 'Cakes' },
  { id: 'pastries', label: 'Pastries' },
  { id: 'breakfast', label: 'Breakfast' },
];

export const PRODUCTS = [
  {
    id: 'truffle-box-classic',
    name: 'Truffle Box · Classic',
    category: 'truffles',
    price: 185,
    weight: '480 g',
    dimensions: '32 × 14 × 5 cm',
    pieces: 30,
    piecesShort: '30 pcs',
    piecesLabel: '30 pieces',
    piecesDetail: '30 truffles',
    subtitle: 'Signature gift box · Contains milk, nuts',
    description: [
      'Thirty hand-finished truffles in a classic assortment of salted caramel, pistachio praline, white chocolate and milk ganache, set in our signature maroon gift box with a ribbed lid. Made to be shared around the table.',
      'Every box is filled by hand on the morning it is sent. Open the ribbed lid to find three rows of truffles in individual paper cups, ready to serve.',
    ],
    shelfLife: '21 days',
    storage: '16 – 20 °C, dry place',
    ingredients: 'Chocolate, cream, butter, sugar, almonds, pistachios, hazelnuts, salted caramel, vanilla.',
    allergens: ['Milk', 'Nuts', 'Soy', 'May contain gluten'],
    images: ['truffle-box-classic-1', 'truffle-box-classic-2', 'truffle-box-classic-3'],
    cardFocus: '50% 78%',
    featured: true,
    unavailableAt: [],
  },
  {
    id: 'truffle-box-praline',
    name: 'Truffle Box · Praline',
    category: 'truffles',
    price: 185,
    weight: '480 g',
    dimensions: '32 × 14 × 5 cm',
    pieces: 30,
    piecesShort: '30 pcs',
    piecesLabel: '30 pieces',
    piecesDetail: '30 truffles',
    subtitle: 'Orange gift box · Contains milk, nuts',
    description: [
      'A richer assortment of dark chocolate, hazelnut praline and caramelised nut truffles, presented in the signature orange gift box. A gift that arrives ready to open.',
      'Each truffle is finished by hand with a crisp praline shell, then nested in its own paper cup so the box travels well across the city.',
    ],
    shelfLife: '21 days',
    storage: '16 – 20 °C, dry place',
    ingredients: 'Dark chocolate, hazelnut praline, caramelised almonds, cream, butter, sugar, sea salt, vanilla.',
    allergens: ['Milk', 'Nuts', 'Soy', 'May contain gluten'],
    images: ['truffle-box-praline-1', 'truffle-box-praline-2', 'truffle-box-praline-3'],
    cardFocus: '50% 60%',
    isNew: true,
    unavailableAt: ['khobar-corniche'], // demo stock gap → ships from Dhahran (as order KR-20291 in the PDF),
  },
  {
    id: 'burnt-chocolate-cheesecake',
    name: 'Burnt Chocolate Cheesecake',
    category: 'cakes',
    price: 28,
    weight: '160 g',
    dimensions: '10 × 9 × 5 cm',
    pieces: 1,
    piecesShort: '1 slice',
    piecesLabel: '1 slice',
    piecesDetail: '1 slice',
    subtitle: 'Single slice · Contains milk, eggs, gluten',
    description: [
      'A creamy, deeply caramelised cheesecake slice finished with a lattice of dark chocolate. Baked fresh each morning.',
      'Baked at a high heat for its burnt, caramelised top, then rested overnight so the centre stays soft and creamy.',
    ],
    shelfLife: '3 days',
    storage: '2 – 6 °C, refrigerated',
    ingredients: 'Cream cheese, cream, eggs, sugar, dark chocolate, cocoa, wheat flour, vanilla.',
    allergens: ['Milk', 'Eggs', 'Gluten'],
    images: ['burnt-chocolate-cheesecake-2', 'burnt-chocolate-cheesecake-1', 'burnt-chocolate-cheesecake-3'],
    cardFocus: '50% 50%',
    unavailableAt: [],
  },
  {
    id: 'cinnamon-roll',
    name: 'Cinnamon Roll',
    category: 'pastries',
    price: 22,
    weight: '140 g',
    dimensions: '9 × 9 × 6 cm',
    pieces: 1,
    piecesShort: '1 pc',
    piecesLabel: '1 piece',
    piecesDetail: '1 piece',
    subtitle: 'Fresh pastry · Contains milk, eggs, gluten',
    description: [
      'A soft, spiralled roll with warm cinnamon and a glossy cream-cheese glaze. Best enjoyed the same day.',
      'Rolled and baked in small batches through the day, then finished with the glaze while still warm.',
    ],
    shelfLife: 'Same day',
    storage: 'Room temperature, covered',
    ingredients: 'Wheat flour, butter, milk, eggs, sugar, cinnamon, cream cheese, yeast, salt.',
    allergens: ['Milk', 'Eggs', 'Gluten'],
    images: ['cinnamon-roll-2', 'cinnamon-roll-1', 'cinnamon-roll-3'],
    cardFocus: '50% 60%',
    unavailableAt: [],
  },
  {
    id: 'berry-pancakes',
    name: 'Berry Pancakes',
    category: 'breakfast',
    price: 36,
    weight: '220 g',
    dimensions: '20 × 20 × 5 cm',
    pieces: 3,
    piecesShort: '3 pcs',
    piecesLabel: '3 pancakes',
    piecesDetail: '3 pancakes',
    subtitle: 'Breakfast · Contains milk, eggs, gluten',
    description: [
      'Fluffy buttermilk pancakes served with fresh berries and passion fruit. A slow-morning favourite.',
      'Packed with a pot of maple syrup and whipped butter on the side. Best enjoyed within an hour of delivery.',
    ],
    shelfLife: 'Same day',
    storage: 'Serve warm',
    ingredients: 'Wheat flour, buttermilk, eggs, butter, sugar, strawberries, blueberries, blackberries, passion fruit, maple syrup.',
    allergens: ['Milk', 'Eggs', 'Gluten'],
    images: ['berry-pancakes-2', 'berry-pancakes-1', 'berry-pancakes-3'],
    cardFocus: '50% 55%',
    unavailableAt: [],
  },
  {
    id: 'butter-croissant-box',
    name: 'Butter Croissant Box',
    category: 'pastries',
    price: 64,
    weight: '380 g',
    dimensions: '24 × 24 × 7 cm',
    pieces: 4,
    piecesShort: '4 pcs',
    piecesLabel: '4 pastries',
    piecesDetail: '4 pastries',
    subtitle: 'Box of 4 · Contains milk, eggs, gluten, nuts',
    description: [
      'A box of four laminated pastries: butter croissant, chocolate twist, hazelnut cruffin and a flaky pain au chocolat.',
      'Laminated with cultured butter over three days for a crisp, shattering shell and a soft, honeycombed centre.',
    ],
    shelfLife: '2 days',
    storage: 'Room temperature, dry place',
    ingredients: 'Wheat flour, butter, milk, eggs, sugar, dark chocolate, hazelnuts, yeast, salt.',
    allergens: ['Milk', 'Eggs', 'Gluten', 'Nuts'],
    images: ['butter-croissant-box-1', 'butter-croissant-box-2', 'butter-croissant-box-3'],
    cardFocus: '50% 50%',
    unavailableAt: [],
  },
];

export function getProduct(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

/** "30 pcs · 480 g" */
export function productMeta(product) {
  return `${product.piecesShort} · ${product.weight}`;
}

export const SORT_OPTIONS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'price-asc', label: 'Price: low to high' },
  { id: 'price-desc', label: 'Price: high to low' },
  { id: 'name', label: 'Name: A to Z' },
];

/** Search + category + sort (pure). */
export function filterProducts(products, { query = '', category = 'all', sort = 'recommended' } = {}) {
  const q = query.trim().toLowerCase();
  let list = products.filter((p) => category === 'all' || p.category === category);
  if (q) {
    list = list.filter((p) =>
      [p.name, p.category, p.subtitle, p.description[0], p.ingredients].join(' ').toLowerCase().includes(q),
    );
  }
  const sorted = [...list];
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
}
