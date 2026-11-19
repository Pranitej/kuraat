/**
 * Shapes of the kuraat server API (server/README.md, server/src/modules/*). The shared JS services
 * return these; screens and providers are typed against them.
 */

export type Gender = 'male' | 'female' | 'other';
export type LatLng = { lat: number; lng: number };

export type User = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: Gender | null;
  avatar: string | null;
  hasPassword: boolean;
  createdAt: string;
};

export type Tokens = { accessToken: string; refreshToken: string; expiresIn?: number };

export type OtpPurpose = 'signup' | 'signin' | 'reset' | 'delete-account';

/** The pending WhatsApp verification kept for one app launch (authService.js). */
export type PendingOtp = {
  challengeId: string;
  phone: string;
  purpose: OtpPurpose;
  length: number;
  resendAt: string;
  expiresAt: string;
  sentAt: number;
  payload?: unknown;
  verified?: boolean;
  verificationToken?: string;
};

export type Category = { id: string; name: string; slug?: string };

export type Product = {
  id: string;
  name: string;
  description: string[];
  price: number;
  categoryId: string;
  categoryName: string;
  images: string[];
  inStock: boolean;
  maxQuantity: number;
  meta: string;
  subtitle: string;
  badge: string | null;
  featured: boolean;
  highlights: { label: string; value: string }[];
  ingredients: string;
  allergens: string[];
  details: { key: string; label: string; value: string }[];
};

export type BranchHours = { open: string; close: string } | Record<string, unknown>;

/** A delivery branch as `toBranchView` shapes it (name without the brand; displayName with it). */
export type Branch = {
  id: string;
  name: string;
  displayName: string;
  shortName: string;
  address: string;
  city: string;
  phone: string;
  /** RSOF's branch type in lower case ('hub', 'master', …); may be empty. */
  type?: string;
  /** Only hubs deliver; the directory also lists the others. Missing = treated as a hub. */
  isHub?: boolean;
  location: LatLng;
  hours: BranchHours;
  openNow: boolean;
  distanceKm?: number | null;
};

export type AddressType = 'home' | 'office' | 'other';

export type Address = {
  id: string;
  label: string;
  type: AddressType;
  line: string;
  district: string;
  city: string;
  postcode: string;
  landmark: string;
  contactName: string;
  location: LatLng;
  isDefault: boolean;
};

export type CartItem = { productId: string; qty: number };
export type CartWarning = 'qty_reduced' | 'price_changed' | 'unavailable' | 'out_of_stock' | null;

export type PricedLine = {
  productId: string;
  qty: number;
  product: { id: string; name: string; price: number; images: string[]; meta?: string } | null;
  lineTotal: number;
  available: boolean;
  maxQuantity: number;
  warning: CartWarning;
};

export type Totals = { count: number; subtotal: number; total: number };

export type PricedCart = { items: PricedLine[]; totals: Totals };

/**
 * Delivery: the branch that would deliver and the slot. Pickup (design 2026-11-18 §5.3): the nearest
 * branch to the customer (may be null) and the stored cart priced from RSOF's product prices.
 */
export type Quote = {
  fulfilment?: 'delivery' | 'pickup';
  branch: Branch | null;
  distanceKm: number | null;
  isNearest: boolean | null;
  inStock: boolean | null;
  window?: { start: string; end: string };
  totals?: Totals;
};

/** Filter groups from the server's status table (server/src/rof/status.js). */
export type OrderGroup = 'placed' | 'attention' | 'preparing' | 'ready' | 'on_the_way' | 'completed' | 'cancelled';

export type OrderStatus = { id: string; code: string | null; label: string; group: OrderGroup; step: number; cancelled: boolean };

export type Order = {
  id: string;
  number: string;
  /** Orders from before pickup existed have none: they are deliveries. */
  fulfilment?: 'delivery' | 'pickup';
  status: OrderStatus;
  steps: {
    id: string;
    title: string;
    state: 'done' | 'current' | 'todo';
    time: string | null;
    timeEnd?: string | null;
    estimated: boolean;
  }[];
  /** Every status change RSOF recorded, oldest first. Orders placed a moment ago may not have it yet. */
  history?: { id: string; label: string; group: string; cancelled: boolean; time: string | null; note: string | null }[];
  items: { productId: string; name: string; qty: number; price: number; image: string | null }[];
  subtotal: number;
  total: number;
  payment: {
    method: PaymentMethod;
    /** Where the money stands (server/README.md → Card payments). Older server replies have none. */
    status?: PaymentStatus;
    /** Only older simulated card payments: RSOF's payment page keeps the card. */
    brand: string | null;
    last4: string | null;
    transactionId: string | null;
    paidAt: string | null;
    /** RSOF's payment page: only in the reply that placed a card order (never stored). */
    link?: string | null;
    linkExpiresAt?: string | null;
  } | null;
  branch: (Partial<Omit<Branch, 'phone' | 'location'>> & { id: string; name: string; phone?: string; location?: LatLng }) | null;
  distanceKm: number | null;
  /** null for a pickup order. */
  address: (Partial<Address> & { city?: string }) | null;
  deliveryPhone: string;
  /** nulls for a pickup order. */
  window: { start: string | null; end: string | null };
  canCancel: boolean;
  canResendCode: boolean;
  createdAt: string;
  cancelledAt: string | null;
};

/** Saudi Arabia: card (incl. Mada), cash on delivery, or (pickup) pay at the branch. */
export type PaymentMethod = 'card' | 'cod' | 'branch';

/** paid · pending (card, not paid yet) · later (cash / at branch) · refund_pending · refunded · cancelled */
export type PaymentStatus = 'paid' | 'pending' | 'later' | 'refund_pending' | 'refunded' | 'cancelled';

/** POST /orders/:id/pay */
export type PayAnswer = { status: 'paid' } | { status: 'pending'; link: string; expiresAt: string | null; amount: number; currency: string };

export type Fulfilment = 'delivery' | 'pickup';

/** Server error as the shared ApiError carries it. */
export type ApiErrorLike = Error & { code: string; field: string | null; status: number };
