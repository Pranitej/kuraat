/**
 * Delivery slot and step estimates (ROF has no estimates — guide §9.2). Saudi-time port of the
 * client's domain/delivery.js: a 2-hour slot starting at least 4.5 hours after ordering, on the hour,
 * with slot starts between 12:00 and 22:00 Saudi time.
 */
import { DELIVERY_SLOT } from '../../config/business.js';
import { fromSaudi, saudiParts } from '../../lib/time.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** @returns {{ start: Date, end: Date }} */
export function deliveryWindow(from) {
  const { leadMinutes, lengthMinutes, firstStartHour, lastStartHour } = DELIVERY_SLOT;
  // Saudi time is a whole number of hours from UTC, so UTC hour boundaries are Saudi hour boundaries.
  let start = new Date(Math.ceil((from.getTime() + leadMinutes * MINUTE) / HOUR) * HOUR);
  const p = saudiParts(start);
  if (p.hour > lastStartHour) start = fromSaudi({ year: p.year, month: p.month, day: p.day + 1, hour: firstStartHour });
  else if (p.hour < firstStartHour) start = fromSaudi({ year: p.year, month: p.month, day: p.day, hour: firstStartHour });
  return { start, end: new Date(start.getTime() + lengthMinutes * MINUTE) };
}

const sameSaudiDay = (a, b) => {
  const x = saudiParts(a);
  const y = saudiParts(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
};

/** "Estimated …" times for the tracking steps (ISO strings). */
export function estimates(createdAt) {
  const { start, end } = deliveryWindow(createdAt);
  // Same-day orders go straight to the kitchen; next-day orders are prepared fresh that morning.
  const preparingAt = sameSaudiDay(start, createdAt) ? new Date(createdAt.getTime() + 4 * MINUTE) : new Date(start.getTime() - 2 * HOUR);
  return {
    preparingAt: preparingAt.toISOString(),
    outForDeliveryAt: new Date(start.getTime() - 30 * MINUTE).toISOString(),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}
