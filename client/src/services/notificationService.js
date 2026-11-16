/**
 * Notifications from the server (server/README.md → Notifications). The server creates them —
 * welcome, password, payment, order confirmed, and the status changes its poller sees in RSOF.
 */
import { apiRequest } from './api.js';

export const listNotifications = () => apiRequest('/notifications');
export const markNotificationRead = (id) => apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
export const markAllNotificationsRead = () => apiRequest('/notifications/read-all', { method: 'POST' });
