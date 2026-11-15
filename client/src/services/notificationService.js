/** Notifications service (demo implementation of the future /notifications API + push). */

import { orderStatus, getBranch, uid } from '@/domain';
import { getDb, updateDb, userBucket } from './db.js';
import { request } from './request.js';

const STATUS_MESSAGES = {
  out_for_delivery: (order, branch) => ({
    title: `Order #${order.id} is on its way`,
    body: `Your courier has left ${branch.displayName}.`,
    createdAt: order.schedule.outForDeliveryAt,
  }),
  delivered: (order, branch) => ({
    title: `Order #${order.id} delivered`,
    body: `Delivered from ${branch.displayName}. Enjoy!`,
    createdAt: order.schedule.deliveredAt,
  }),
};

/**
 * Emits a notification each time an order reaches a new status (what push notifications
 * deliver in production). Each order records which statuses were already announced.
 */
export function syncOrderNotifications(userId, now = new Date()) {
  const orders = getDb().orders?.[userId] || [];
  const pending = [];
  orders.forEach((order) => {
    const status = orderStatus(order, now);
    const announced = order.statusNotified || [];
    const reached = ['out_for_delivery', 'delivered'].filter((id) => {
      if (id === 'out_for_delivery') return status.step >= 2;
      return status.step >= 3;
    });
    reached.filter((id) => !announced.includes(id)).forEach((id) => pending.push({ orderId: order.id, id }));
  });
  if (!pending.length) return false;
  updateDb((db) => {
    const list = userBucket(db, 'notifications', userId);
    pending.forEach(({ orderId, id }) => {
      const order = db.orders[userId].find((o) => o.id === orderId);
      const msg = STATUS_MESSAGES[id](order, getBranch(order.branchId));
      list.push({ id: uid('n'), type: id, ...msg, read: false, link: { kind: 'order', id: orderId } });
      order.statusNotified = [...(order.statusNotified || []), id];
    });
  });
  return true;
}

export async function listNotifications(userId) {
  return request(() => {
    syncOrderNotifications(userId);
    return [...(getDb().notifications?.[userId] || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, { min: 200, max: 400 });
}

export async function markNotificationRead(userId, id) {
  return request(
    () =>
      updateDb((db) => {
        const n = userBucket(db, 'notifications', userId).find((x) => x.id === id);
        if (n) n.read = true;
        return n;
      }),
    { min: 80, max: 160 },
  );
}

export async function markAllNotificationsRead(userId) {
  return request(
    () =>
      updateDb((db) => {
        userBucket(db, 'notifications', userId).forEach((n) => (n.read = true));
        return true;
      }),
    { min: 250, max: 450 },
  );
}
