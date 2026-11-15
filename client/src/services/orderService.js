/** Orders service (demo implementation of the future /orders API). */

import { computeTotals, getProduct, findPromo, chooseBranch, orderSchedule, formatSAR, paymentLabel, uid } from '@/domain';
import { getDb, updateDb, userBucket } from './db.js';
import { request, ApiError } from './request.js';

export async function listOrders(userId) {
  return request(
    () => [...(getDb().orders?.[userId] || [])].sort((a, b) => new Date(b.schedule.createdAt) - new Date(a.schedule.createdAt)),
    { min: 250, max: 500 },
  );
}

export async function getOrder(userId, id) {
  return request(() => {
    const order = (getDb().orders?.[userId] || []).find((o) => o.id === id);
    if (!order) throw new ApiError('We could not find this order.', { code: 'not_found' });
    return order;
  }, { min: 200, max: 400 });
}

/**
 * Places an order after payment. Re-checks branch selection and stock "server-side".
 * @param {{ userId, cart: {items, promoCode}, address, deliveryPhone, payment }} input
 */
export async function placeOrder({ userId, cart, address, deliveryPhone, payment }) {
  return request(
    () =>
      updateDb((db) => {
        if (!cart.items.length) throw new ApiError('Your cart is empty.', { code: 'empty_cart' });
        const promo = findPromo(cart.promoCode);
        const totals = computeTotals(cart.items, getProduct, promo);
        const choice = chooseBranch(address.location, cart.items.map((i) => i.productId));
        db.meta.orderSeq += 1;
        const id = `KR-${db.meta.orderSeq}`;
        const now = new Date();
        const order = {
          id,
          userId,
          items: totals.lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.product.price })),
          subtotal: totals.subtotal,
          discount: totals.discount,
          delivery: totals.delivery,
          total: totals.total,
          vat: totals.vat,
          promoCode: promo ? promo.code : null,
          branchId: choice.branch.id,
          distanceKm: choice.distanceKm,
          address: { ...address },
          deliveryPhone,
          payment,
          schedule: orderSchedule(now),
        };
        userBucket(db, 'orders', userId).unshift(order);

        const notifications = userBucket(db, 'notifications', userId);
        if (payment.method !== 'cod') {
          notifications.unshift({
            id: uid('n'),
            type: 'payment',
            title: 'Payment received',
            body: `${formatSAR(order.total)} paid with ${paymentLabel(payment)}.`,
            createdAt: now.toISOString(),
            read: false,
            link: { kind: 'order', id },
          });
        }
        notifications.unshift({
          id: uid('n'),
          type: 'order',
          title: `Order #${id} confirmed`,
          body: `It will be delivered from ${choice.branch.displayName}.`,
          createdAt: new Date(now.getTime() + 1000).toISOString(),
          read: false,
          link: { kind: 'order', id },
        });

        // Order placed → cart is emptied on the "server"
        if (db.carts?.[userId]) db.carts[userId] = { items: [], promoCode: null };
        return order;
      }),
    { min: 500, max: 800 },
  );
}

/** Whether the user has completed an order before (for first-order promos). */
export function hasOrders(userId) {
  return (getDb().orders?.[userId] || []).length > 0;
}
