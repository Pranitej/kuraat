/**
 * Names of the ROF product custom fields the app gives a special place (design spec §6.5).
 * ROF has no standard fields for these; RSOF's admin creates them in product settings (guide §5).
 *
 * THIS IS THE ONLY PLACE THE KEYS ARE NAMED. When RSOF tells us the real keys in the kuraat tenant,
 * change the values here — nothing else needs to change.
 */
export const FIELD_MAP = {
  /** "30 pcs" — first half of the card line "30 pcs · 480 g"; a number is shown as "<n> pcs". */
  pieces: 'pieces',
  /** Grams (number) — second half of the card line; detail row shows "480 g". */
  weight: 'weight_g',
  /** Line under the product title. */
  subtitle: 'subtitle',
  /** Small tag on the product card, e.g. "New". */
  badge: 'badge',
  /** true on the product shown in the Home hero. */
  featured: 'featured',
};

/** Keys used for placement only — never shown as plain detail rows. */
export const PLACEMENT_ONLY_KEYS = [FIELD_MAP.subtitle, FIELD_MAP.badge, FIELD_MAP.featured];
