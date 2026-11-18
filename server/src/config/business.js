/**
 * Business rules the RSOF order system (ROF) does not hold, so our backend owns them
 * (design spec §2 and §6.2). Values agreed with the lead; change them here only.
 */

/** Saudi Arabia: UTC+3 all year (no daylight saving). All business times use it. */
export const SAUDI_UTC_OFFSET_MINUTES = 180;

export const VAT_RATE = 0.15;
export const DELIVERY_FEE = 15;
export const MAX_ITEM_QTY = 20;

/**
 * Promo codes that are live. NONE: the apps have no promo field (removed 18 Nov 2026), and the old test codes
 * (KURAAT10, WELCOME15, FREEDELIVERY) must not work on real orders, so any code sent to the API is refused as
 * "not valid". To launch a code, add it here, e.g.
 *   SUMMER10: { code: 'SUMMER10', type: 'percent', value: 10, label: '10% off your sweets' }
 * (type 'percent' or 'delivery'; add firstOrderOnly: true for a first-order code). Tests inject their own.
 */
export const PROMO_CODES = {};

/** Opening hours (24 h clock, Saudi time). close 24 = midnight. */
export const DEFAULT_BRANCH_HOURS = { open: 10, close: 24 };
/** Per-branch overrides keyed by ROF branch id, e.g. { '<guid>': { open: 12, close: 23 } }. */
export const BRANCH_HOURS_OVERRIDES = {};

/** Delivery slots: 2 hours long, starting at least 4.5 hours after ordering, between 12:00 and 24:00. */
export const DELIVERY_SLOT = { leadMinutes: 270, lengthMinutes: 120, firstStartHour: 12, lastStartHour: 22 };

/** A further branch may take over (stock) only if it is at most this much further than the nearest. */
export const MAX_DETOUR_KM = 25;

/** Login codes sent on WhatsApp. */
export const OTP_RULES = { length: 6, expiryMinutes: 10, maxAttempts: 5, resendSeconds: 60 };
