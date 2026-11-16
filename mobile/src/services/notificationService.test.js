import { afterEach, expect, test, vi } from 'vitest';
import { stubFetch } from '@/test/stubFetch.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from './notificationService.js';

afterEach(() => vi.unstubAllGlobals());

test('one call per endpoint', async () => {
  const calls = stubFetch(() => ({ body: [] }));
  await listNotifications();
  await markNotificationRead('n1');
  await markAllNotificationsRead();
  expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /notifications', 'POST /notifications/n1/read', 'POST /notifications/read-all']);
});
