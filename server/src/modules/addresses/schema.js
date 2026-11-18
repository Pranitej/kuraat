/**
 * Address validation shared by sign-up (Home address) and the addresses API.
 * Coordinates are optional (the customer may not share their location); when given they must be real ones.
 */
import { z } from 'zod';

/** Rough bounding box of Saudi Arabia; anything outside cannot be delivered to. */
export const SAUDI_BOUNDS = { minLat: 16, maxLat: 33, minLng: 34, maxLng: 56 };
export const isInSaudi = ({ lat, lng }) =>
  lat >= SAUDI_BOUNDS.minLat && lat <= SAUDI_BOUNDS.maxLat && lng >= SAUDI_BOUNDS.minLng && lng <= SAUDI_BOUNDS.maxLng;

export const OUT_OF_AREA_MESSAGE = 'We deliver only within Saudi Arabia. Move the pin to your address.';

export const locationSchema = z.object(
  { lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) },
  { error: 'Pick the address on the map.' },
);

/** Address fields collected at sign-up. */
export const signupAddressSchema = z.object({
  line: z.string().trim().min(3, 'Enter the building and street').max(200),
  district: z.string().trim().max(100).default(''),
  city: z.string().trim().min(2, 'Choose a city').max(60),
  postcode: z.string().trim().max(10).optional(),
  location: locationSchema.optional(),
});

/** Full address as saved in the address book. */
export const addressInputSchema = signupAddressSchema.extend({
  type: z.enum(['home', 'office', 'other']).default('home'),
  label: z.string().trim().max(60).optional(),
  landmark: z.string().trim().max(200).default(''),
  isDefault: z.boolean().optional(),
});
