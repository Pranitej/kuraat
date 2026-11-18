/**
 * Placing an order (design spec §6.7; guide §7). Order of operations:
 *   1. same idempotency key → return the earlier result (never a second ROF order — the ROF create
 *      call is not idempotent, guide §7.1)
 *   2. re-price the cart from ROF; refuse if anything changed since the customer last saw it
 *   3. candidate hub branches by distance (and stock, if the inventory check is on)
 *   4. authorise the (simulated) payment
 *   5. create the order in ROF — rejected → void payment; timeout → needs_review, NO retry
 *   6. save the ROF id/number at once
 *   7. assign the nearest candidate branch, falling back to the next (guide §7.2); none → cancel in ROF
 *   8. capture payment, notifications, saved card, empty cart
 */
import { AppError, badRequest, conflict, notFound, unavailable } from '../../http/errors.js';
import { newId } from '../../lib/ids.js';
import { toCreatedOrder, toRofOrderPayload } from '../../rof/adapter.js';
import { isRofError } from '../../rof/errors.js';
import { listAddresses, toAddress } from '../addresses/routes.js';
import { findUserById } from '../auth/service.js';
import { saveCard } from '../cards/routes.js';
import { loadCart, priceForUser, saveCart } from '../cart/routes.js';
import { deliveryCandidates } from '../checkout/branchChoice.js';
import { estimates } from '../checkout/window.js';
import { notify } from '../notifications/service.js';
import { authorizePayment } from '../payments/simulator.js';

const UNCONFIRMED = "We couldn't confirm your order with the store. Please contact us before trying again — you won't be charged twice.";

const sar = (n) => `SAR ${Number(n).toFixed(2)}`;
const paymentLabel = (p) => (p.method === 'card' ? `${p.brand} •••• ${p.last4}` : 'cash on delivery');

/** First problem in a priced cart, as a customer-facing message (null when the cart is fine). */
function cartProblem(priced) {
  for (const line of priced.items) {
    const name = line.product?.name ?? 'A product in your cart';
    if (line.warning === 'unavailable') return `${name} is no longer available. Remove it to continue.`;
    if (line.warning === 'out_of_stock') return `${name} is out of stock. Remove it to continue.`;
    if (line.warning === 'qty_reduced') return `Only ${line.qty} of ${name} left. Check your cart.`;
    if (line.warning === 'price_changed') return `The price of ${name} changed to ${sar(line.product.price)}. Check your cart.`;
  }
  return null;
}

/** Re-raise the outcome of an earlier attempt with the same idempotency key. */
async function replay(ctx, userId, existing) {
  if (existing.user_id !== userId) throw conflict('idempotency_conflict', 'This checkout session is not valid. Please start again.');
  if (existing.status === 'captured' && existing.order_id) return { order: await orderFor(ctx, existing.order_id), created: false };
  if (existing.status === 'needs_review') throw unavailable('order_unconfirmed', UNCONFIRMED);
  if (existing.status === 'authorized') throw conflict('order_in_progress', 'Your order is being placed. Please wait a moment.');
  return null; // failed / voided: this key may try again
}

const orderFor = async (ctx, orderId) => ctx.orders.present(await ctx.db('orders').where({ id: orderId }).first());

/** Insert or (for a failed/voided earlier attempt) overwrite the payment row for this key. */
async function upsertPayment(ctx, userId, key, fields) {
  const now = ctx.clock.now();
  const existing = await ctx.db('payments').where({ idempotency_key: key }).first();
  if (existing) {
    // A failed/voided earlier attempt: claim its row for this attempt. The status condition makes the
    // claim atomic — of two simultaneous retries only one gets the row (the other is "in progress").
    const claimed = await ctx.db('payments')
      .where({ id: existing.id })
      .whereIn('status', ['failed', 'voided'])
      .update({ error_code: null, error_message: null, ...fields, updated_at: now });
    if (!claimed) throw conflict('order_in_progress', 'Your order is being placed. Please wait a moment.');
    return existing.id;
  }
  const id = newId();
  try {
    await ctx.db('payments').insert({ id, user_id: userId, idempotency_key: key, ...fields, created_at: now, updated_at: now });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw conflict('order_in_progress', 'Your order is being placed. Please wait a moment.');
    throw error;
  }
  return id;
}

const setPayment = (ctx, id, fields) => ctx.db('payments').where({ id }).update({ ...fields, updated_at: ctx.clock.now() });

/**
 * @param {{ fulfilment?: 'delivery'|'pickup', addressId?, deliveryPhone, promoCode?, payment: { method: 'card'|'cod'|'branch', card?, saveCard? }, idempotencyKey }} input
 * @returns {Promise<{ order: object, created: boolean }>}
 */
export async function placeOrder(ctx, userId, input) {
  const key = input.idempotencyKey;

  // 1 — idempotency
  const earlier = await ctx.db('payments').where({ idempotency_key: key }).first();
  if (earlier) {
    const result = await replay(ctx, userId, earlier);
    if (result) return result;
  }

  // 2 — cart, address, prices
  const cart = await loadCart(ctx.db, userId);
  if (!cart.items.length) throw badRequest('empty_cart', 'Your cart is empty.');
  const pickup = input.fulfilment === 'pickup';
  // A pickup order has no delivery address; delivery needs the address it goes to.
  const addressRow = pickup ? null : await ctx.db('addresses').where({ user_id: userId, id: input.addressId }).first();
  if (!pickup && !addressRow) throw notFound('not_found', 'This address no longer exists.');
  const promoCode = input.promoCode !== undefined ? input.promoCode : cart.promoCode;
  const priced = await priceForUser(ctx, userId, { items: cart.items, promoCode }, { fulfilment: pickup ? 'pickup' : 'delivery' });
  const problem = cartProblem(priced);
  if (problem) throw conflict('cart_changed', problem);
  const items = priced.items.map((l) => ({ productId: l.productId, qty: l.qty }));

  // 3 — coverage: ROF picks the branch (design 2026-11-18 §5.2), but we still only take orders for
  // addresses a hub serves.
  const address = pickup ? null : toAddress(addressRow);
  if (!pickup) {
    const { candidates } = await deliveryCandidates(ctx, address.location, items);
    if (!candidates.length) throw conflict('no_branch', "We don't have a branch that delivers to this address yet.");
  }

  // 4 — payment
  const amount = priced.totals.total;
  let paid;
  try {
    paid = authorizePayment({ ...input.payment, amount }, { now: ctx.clock.now() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'card_declined') {
      // Record the decline; if another attempt with this key is already running, leave its row alone.
      await upsertPayment(ctx, userId, key, { method: input.payment.method, status: 'failed', amount, error_code: error.code, error_message: error.message }).catch(
        (e) => {
          if (e.code !== 'order_in_progress') throw e;
        },
      );
    }
    throw error;
  }
  const paymentId = await upsertPayment(ctx, userId, key, {
    method: paid.method,
    status: 'authorized',
    amount,
    brand: paid.brand,
    last4: paid.last4,
    transaction_id: paid.transactionId,
  });

  // 5 — create in ROF (exactly once for this payment)
  const user = await findUserById(ctx.db, userId);
  // Pickup: where the customer is — their last known location, else their default address — gives ROF's
  // auto-assignment a pin and the order a city; with neither, staff assign the branch by hand.
  const usual = pickup ? await listAddresses(ctx.db, userId).first() : null;
  const pickupAddress = usual ? toAddress(usual) : null;
  const pin = pickup ? (user.last_lat != null && user.last_lng != null ? { lat: Number(user.last_lat), lng: Number(user.last_lng) } : pickupAddress?.location ?? null) : address.location;
  let created;
  try {
    created = toCreatedOrder(
      await ctx.rof.createOrder(
        toRofOrderPayload({
          user,
          address,
          deliveryPhone: input.deliveryPhone,
          items,
          payment: paid,
          total: amount,
          fulfilment: pickup ? 'pickup' : 'delivery',
          city: pickupAddress?.city ?? null,
        }),
      ),
    );
  } catch (error) {
    if (isRofError(error, 'rejected')) {
      await setPayment(ctx, paymentId, { status: 'voided', error_code: 'rof_rejected', error_message: error.message.slice(0, 300) });
      throw conflict('rof_rejected', error.message);
    }
    await setPayment(ctx, paymentId, { status: 'needs_review', error_code: 'rof_unconfirmed', error_message: error.message.slice(0, 300) });
    ctx.logger.error(`[orders] ROF create unconfirmed for payment ${paymentId} (key ${key}): ${error.message} — reconcile manually`);
    throw unavailable('order_unconfirmed', UNCONFIRMED);
  }

  // 6 — remember the ROF order immediately
  const now = ctx.clock.now();
  const orderId = newId();
  const est = pickup ? {} : estimates(now); // no delivery slot or step estimates for pickup
  const lineRows = priced.items.map((l) => ({ productId: l.productId, name: l.product.name, qty: l.qty, price: l.product.price, image: l.product.image }));
  await ctx.db.transaction(async (trx) => {
    await trx('orders').insert({
      id: orderId,
      user_id: userId,
      fulfilment: pickup ? 'pickup' : 'delivery',
      rof_order_id: created.rofOrderId,
      rof_order_number: created.orderNumber,
      rof_status: created.status || 'Created',
      rof_status_at: now,
      step: 0,
      cancelled: false,
      address: address ? JSON.stringify(address) : null,
      delivery_phone: input.deliveryPhone,
      lines: JSON.stringify(lineRows),
      subtotal: priced.totals.subtotal,
      discount: priced.totals.discount,
      delivery_fee: priced.totals.delivery,
      vat: priced.totals.vat,
      total: priced.totals.total,
      promo_code: priced.promo?.valid ? priced.promo.code : null,
      window_start: pickup ? null : new Date(est.windowStart),
      window_end: pickup ? null : new Date(est.windowEnd),
      estimates: JSON.stringify(est),
      step_times: JSON.stringify({ 0: now.toISOString() }),
      notified: JSON.stringify([]),
      created_at: now,
      updated_at: now,
    });
    await trx('payments').where({ id: paymentId }).update({ order_id: orderId, updated_at: now });
  });

  // 7 — the customer's pin: ROF assigns the nearest branch with stock from it. A failure never
  // fails the order (it is placed and paid); RSOF staff can still assign a branch by hand.
  let locationShared = pin ? true : null;
  try {
    if (pin) await ctx.rof.shareOrderLocation(created.rofOrderId, pin);
    else ctx.logger.info(`[orders] KR-${created.orderNumber} is a pickup order with no known location — RSOF staff must assign a branch`);
  } catch (error) {
    // Whatever went wrong, the order is placed and the payment is held: never fail or lock it here.
    locationShared = false;
    const kind = isRofError(error) ? ` (${error.kind})` : '';
    const level = isRofError(error) ? 'warn' : 'error';
    ctx.logger[level](`[orders] could not send the pin for KR-${created.orderNumber} to ROF${kind}: ${error.message} — RSOF staff must assign a branch`);
  }

  // 8 — done: payment captured, then read the order once so an instant auto-assignment shows.
  const doneAt = ctx.clock.now();
  await ctx.db.transaction(async (trx) => {
    await trx('orders').where({ id: orderId }).update({ location_shared: locationShared, updated_at: doneAt });
    await trx('payments').where({ id: paymentId }).update({ status: 'captured', updated_at: doneAt });
    if (paid.method === 'card' && input.payment.saveCard) await saveCard(trx, userId, { brand: paid.brand, last4: paid.last4, expiry: paid.expiry }, doneAt);
  });
  const synced = await ctx.orders.refresh(await ctx.db('orders').where({ id: orderId }).first(), { maxAgeMs: 0 }).catch((error) => {
    ctx.logger.warn(`[orders] could not re-read KR-${created.orderNumber} after placing it: ${error.message}`);
    return null;
  });

  const number = `KR-${created.orderNumber}`;
  const link = { kind: 'order', id: orderId };
  const branchName = synced?.branch_name;
  await ctx.db.transaction(async (trx) => {
    if (paid.method === 'card') {
      await notify(trx, userId, { type: 'payment', title: 'Payment received', body: `${sar(amount)} paid with ${paymentLabel(paid)}.`, link }, doneAt);
    }
    const body = branchName
      ? pickup
        ? `Collect it from ${branchName}.`
        : `It will be delivered from ${branchName}.`
      : "Your order screen shows the branch once it's confirmed.";
    await notify(trx, userId, { type: 'order', title: `Order #${number} confirmed`, body, link }, new Date(doneAt.getTime() + 1));
  });
  await saveCart(ctx.db, userId, { items: [], promoCode: null }, doneAt);
  return { order: await orderFor(ctx, orderId), created: true };
}
