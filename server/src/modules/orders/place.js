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
import { toAddress } from '../addresses/routes.js';
import { findUserById } from '../auth/service.js';
import { saveCard } from '../cards/routes.js';
import { loadCart, priceForUser, saveCart } from '../cart/routes.js';
import { deliveryCandidates } from '../checkout/branchChoice.js';
import { estimates } from '../checkout/window.js';
import { notify } from '../notifications/service.js';
import { authorizePayment } from '../payments/simulator.js';
import { presentOrder } from './present.js';

const UNCONFIRMED = "We couldn't confirm your order with the store. Please contact us before trying again — you won't be charged twice.";

const sar = (n) => `SAR ${Number(n).toFixed(2)}`;
const paymentLabel = (p) => (p.method === 'card' ? `${p.brand} •••• ${p.last4}` : p.method === 'upi' ? `UPI · ${p.upi_id}` : 'cash on delivery');

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

export async function orderFor(ctx, orderId) {
  const row = await ctx.db('orders').where({ id: orderId }).first();
  const payment = await ctx.db('payments').where({ order_id: orderId }).first();
  const branch = row.branch_id ? await ctx.branches.getBranch(row.branch_id).catch(() => null) : null;
  return presentOrder(row, { payment, branch });
}

/** Insert or (for a failed/voided earlier attempt) overwrite the payment row for this key. */
async function upsertPayment(ctx, userId, key, fields) {
  const now = ctx.clock.now();
  const existing = await ctx.db('payments').where({ idempotency_key: key }).first();
  if (existing) {
    // A failed/voided earlier attempt: reuse its row for this attempt (clearing the old error).
    await ctx.db('payments').where({ id: existing.id }).update({ error_code: null, error_message: null, ...fields, updated_at: now });
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
 * @param {{ addressId, deliveryPhone, promoCode?, payment: { method, card?, upiId?, saveCard? }, idempotencyKey }} input
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
  const addressRow = await ctx.db('addresses').where({ user_id: userId, id: input.addressId }).first();
  if (!addressRow) throw notFound('not_found', 'This address no longer exists.');
  const promoCode = input.promoCode !== undefined ? input.promoCode : cart.promoCode;
  const priced = await priceForUser(ctx, userId, { items: cart.items, promoCode });
  const problem = cartProblem(priced);
  if (problem) throw conflict('cart_changed', problem);
  const items = priced.items.map((l) => ({ productId: l.productId, qty: l.qty }));

  // 3 — branches
  const address = toAddress(addressRow);
  const { candidates } = await deliveryCandidates(ctx, address.location, items);
  if (!candidates.length) throw conflict('no_branch', "We don't have a branch that delivers to this address yet.");

  // 4 — payment
  const amount = priced.totals.total;
  let paid;
  try {
    paid = authorizePayment({ ...input.payment, amount }, { now: ctx.clock.now() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'card_declined') {
      await upsertPayment(ctx, userId, key, { method: input.payment.method, status: 'failed', amount, error_code: error.code, error_message: error.message });
    }
    throw error;
  }
  const paymentId = await upsertPayment(ctx, userId, key, {
    method: paid.method,
    status: 'authorized',
    amount,
    brand: paid.brand,
    last4: paid.last4,
    upi_id: paid.upiId,
    transaction_id: paid.transactionId,
  });

  // 5 — create in ROF (exactly once for this payment)
  const user = await findUserById(ctx.db, userId);
  let created;
  try {
    created = toCreatedOrder(await ctx.rof.createOrder(toRofOrderPayload({ user, address, deliveryPhone: input.deliveryPhone, items })));
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
  const est = estimates(now);
  const lineRows = priced.items.map((l) => ({ productId: l.productId, name: l.product.name, qty: l.qty, price: l.product.price, image: l.product.image }));
  await ctx.db.transaction(async (trx) => {
    await trx('orders').insert({
      id: orderId,
      user_id: userId,
      rof_order_id: created.rofOrderId,
      rof_order_number: created.orderNumber,
      rof_status: created.status || 'Created',
      rof_status_at: now,
      step: 0,
      cancelled: false,
      address: JSON.stringify(address),
      delivery_phone: input.deliveryPhone,
      lines: JSON.stringify(lineRows),
      subtotal: priced.totals.subtotal,
      discount: priced.totals.discount,
      delivery_fee: priced.totals.delivery,
      vat: priced.totals.vat,
      total: priced.totals.total,
      promo_code: priced.promo?.valid ? priced.promo.code : null,
      window_start: new Date(est.windowStart),
      window_end: new Date(est.windowEnd),
      estimates: JSON.stringify(est),
      step_times: JSON.stringify({ 0: now.toISOString() }),
      notified: JSON.stringify([]),
      created_at: now,
      updated_at: now,
    });
    await trx('payments').where({ id: paymentId }).update({ order_id: orderId, updated_at: now });
  });

  // 7 — assign the nearest branch that accepts
  let chosen = null;
  for (const candidate of candidates) {
    try {
      await ctx.rof.assignBranch(created.rofOrderId, candidate.branch.id);
      chosen = candidate;
      break;
    } catch (error) {
      if (!isRofError(error, 'rejected')) {
        await setPayment(ctx, paymentId, { status: 'needs_review', error_code: 'rof_assign_unconfirmed', error_message: error.message.slice(0, 300) });
        ctx.logger.error(`[orders] ROF assign failed for KR-${created.orderNumber}: ${error.message} — assign a branch in ROF manually`);
        throw unavailable('order_unconfirmed', UNCONFIRMED);
      }
      ctx.logger.info(`[orders] ${candidate.branch.name} refused KR-${created.orderNumber}: ${error.message}`);
    }
  }
  if (!chosen) {
    await ctx.rof.cancelOrder(created.rofOrderId).catch((e) => ctx.logger.error(`[orders] could not cancel KR-${created.orderNumber} in ROF: ${e.message}`));
    await ctx.db('orders').where({ id: orderId }).delete();
    await setPayment(ctx, paymentId, {
      status: 'voided',
      error_code: 'not_available_nearby',
      error_message: `ROF order KR-${created.orderNumber} cancelled: no nearby branch could fulfil it`,
    });
    throw conflict('not_available_nearby', "These items aren't available from branches near this address right now.");
  }

  // 8 — done
  const doneAt = ctx.clock.now();
  await ctx.db.transaction(async (trx) => {
    await trx('orders').where({ id: orderId }).update({
      branch_id: chosen.branch.id,
      branch_name: chosen.branch.name,
      distance_km: chosen.distanceKm,
      rof_status: 'AssignedToBranch',
      rof_status_at: doneAt,
      updated_at: doneAt,
    });
    await trx('payments').where({ id: paymentId }).update({ status: 'captured', updated_at: doneAt });
    const number = `KR-${created.orderNumber}`;
    const link = { kind: 'order', id: orderId };
    if (paid.method !== 'cod') {
      await notify(trx, userId, { type: 'payment', title: 'Payment received', body: `${sar(amount)} paid with ${paymentLabel({ ...paid, upi_id: paid.upiId })}.`, link }, doneAt);
    }
    await notify(trx, userId, { type: 'order', title: `Order #${number} confirmed`, body: `It will be delivered from ${chosen.branch.name}.`, link }, new Date(doneAt.getTime() + 1));
    if (paid.method === 'card' && input.payment.saveCard) await saveCard(trx, userId, { brand: paid.brand, last4: paid.last4, expiry: paid.expiry }, doneAt);
  });
  await saveCart(ctx.db, userId, { items: [], promoCode: null }, doneAt);
  return { order: await orderFor(ctx, orderId), created: true };
}
