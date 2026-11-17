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

export type OtpPurpose = 'signup' | 'signin' | 'reset' | 'change-phone' | 'delete-account';

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
  phone: string;
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

export type Promo = { code: string; label: string | null; valid: boolean; error?: string };

export type Totals = { count: number; subtotal: number; discount: number; delivery: number; total: number; vat: number };

export type PricedCart = { items: PricedLine[]; promo: Promo | null; totals: Totals };

export type Quote = {
  branch: Branch;
  distanceKm: number | null;
  isNearest: boolean;
  inStock: boolean;
  window: { start: string; end: string };
};

export type OrderStatus = { id: string; label: string; step: number; cancelled: boolean };

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  steps: {
    id: string;
    title: string;
    state: 'done' | 'current' | 'todo';
    time: string | null;
    timeEnd?: string | null;
    estimated: boolean;
  }[];
  items: { productId: string; name: string; qty: number; price: number; image: string | null }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  vat: number;
  total: number;
  promoCode: string | null;
  payment: {
    method: PaymentMethod;
    brand: string | null;
    last4: string | null;
    transactionId: string | null;
    paidAt: string | null;
  } | null;
  branch: (Partial<Omit<Branch, 'phone' | 'location'>> & { id: string; name: string; phone?: string; location?: LatLng }) | null;
  distanceKm: number | null;
  address: Partial<Address> & { city?: string };
  deliveryPhone: string;
  window: { start: string; end: string };
  canCancel: boolean;
  canResendCode: boolean;
  createdAt: string;
  cancelledAt: string | null;
};

export type NotificationLink = { kind: 'order' | 'product' | 'password' | 'home'; id?: string };

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: NotificationLink | null;
  read: boolean;
  createdAt: string;
};

/** Saudi Arabia: card (incl. Mada) or cash on delivery. */
export type PaymentMethod = 'card' | 'cod';

/** Server error as the shared ApiError carries it. */
export type ApiErrorLike = Error & { code: string; field: string | null; status: number };
