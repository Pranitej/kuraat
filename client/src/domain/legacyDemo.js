/**
 * TEMPORARY — the old browser demo catalogue and branches, kept only for the screens that are not
 * yet on the server (cart, checkout, orders). Deleted once they are (Plan 2, Task 11).
 */

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

/** Demo branches (PDF screen 25) — only for screens not yet on the server. */
export const BRANCHES = [
  { id: 'khobar-corniche', name: 'Al Khobar · Corniche', displayName: 'Kuraat · Al Khobar Corniche', shortName: 'Al Khobar · Corniche', city: 'Al Khobar', area: 'Corniche', address: 'Prince Faisal bin Fahd Rd, Al Khobar 31952', phone: '+966 13 555 0110', hours: { open: 10, close: 24 }, location: { lat: 26.30696, lng: 50.21868 } },
  { id: 'dhahran-king-abdulaziz', name: 'Dhahran · King Abdulaziz Rd', displayName: 'Kuraat · Dhahran · King Abdulaziz Rd', shortName: 'Dhahran · King Abdulaziz', city: 'Dhahran', area: 'King Abdulaziz Rd', address: 'King Abdulaziz Rd, Dhahran 34247', phone: '+966 13 555 0120', hours: { open: 10, close: 24 }, location: { lat: 26.31796, lng: 50.14941 } },
  { id: 'dammam-faisaliyah', name: 'Dammam · Al Faisaliyah', displayName: 'Kuraat · Dammam Al Faisaliyah', shortName: 'Dammam · Al Faisaliyah', city: 'Dammam', area: 'Al Faisaliyah', address: 'Prince Mohammed bin Fahd Rd, Dammam 32245', phone: '+966 13 555 0130', hours: { open: 10, close: 24 }, location: { lat: 26.39798, lng: 50.13722 } },
  { id: 'alahsa-hofuf', name: 'Al Ahsa · Hofuf', displayName: 'Kuraat · Al Ahsa Hofuf', shortName: 'Al Ahsa · Hofuf', city: 'Al Ahsa', area: 'Hofuf', address: 'King Abdullah Rd, Hofuf 36362', phone: '+966 13 555 0140', hours: { open: 10, close: 24 }, location: { lat: 25.30838, lng: 49.53596 } },
  { id: 'riyadh-olaya', name: 'Riyadh · Olaya', displayName: 'Kuraat · Riyadh Olaya', shortName: 'Riyadh · Olaya', city: 'Riyadh', area: 'Olaya', address: 'Olaya St, Al Olaya, Riyadh 12611', phone: '+966 11 555 0150', hours: { open: 10, close: 24 }, location: { lat: 24.71282, lng: 46.71363 } },
  { id: 'jeddah-rawdah', name: 'Jeddah · Al Rawdah', displayName: 'Kuraat · Jeddah Al Rawdah', shortName: 'Jeddah · Al Rawdah', city: 'Jeddah', area: 'Al Rawdah', address: 'Prince Sultan Rd, Al Rawdah, Jeddah 23434', phone: '+966 12 555 0160', hours: { open: 10, close: 24 }, location: { lat: 21.37088, lng: 38.76694 } },
];

export function getBranch(id) {
  return BRANCHES.find((b) => b.id === id) || null;
}
