/** In-app notifications (the list on the Notifications screen). */
import { newId } from '../../lib/ids.js';

/**
 * @param {{ type: string, title: string, body: string, link?: object|null }} notification
 *   type: welcome · security · order · payment · out_for_delivery · delivered · cancelled · product
 */
export async function notify(db, userId, { type, title, body, link = null }, now = new Date()) {
  const row = { id: newId(), user_id: userId, type, title, body, link: link ? JSON.stringify(link) : null, read: false, created_at: now };
  await db('notifications').insert(row);
  return row;
}

export const toNotification = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  link: row.link ?? null,
  read: Boolean(row.read),
  createdAt: new Date(row.created_at).toISOString(),
});

export const WELCOME = {
  type: 'welcome',
  title: 'Welcome to kuraat',
  body: 'Your account is ready. Explore our truffles, cakes and pastries.',
  link: { kind: 'home' },
};

export const passwordNotification = (hadPassword) => ({
  type: 'security',
  title: hadPassword ? 'Password updated' : 'Password set',
  body: hadPassword ? 'Your password was changed successfully.' : 'You can now sign in without a WhatsApp code.',
  link: { kind: 'password' },
});
