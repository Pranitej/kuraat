/**
 * Test context: the real app wired to the test database (TEST_DATABASE_URL), a settable clock, a
 * captured logger and — with { withRof: true } — a fake ROF on a random port reached over real HTTP.
 */
import { loadConfig } from '../../src/config/env.js';
import { createContext } from '../../src/context.js';
import { createDb, migrateLatest } from '../../src/db/knex.js';
import { createApp } from '../../src/http/app.js';
import { createRofClient } from '../../src/rof/client.js';
import { createMockRofHarness } from './mockRof.js';

export function createFakeClock(start = '2026-11-15T09:21:00.000Z') {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    set: (iso) => {
      current = new Date(iso).getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

export async function truncateAll(db) {
  const [rows] = await db.raw(
    "select table_name as name from information_schema.tables where table_schema = database() and table_type = 'BASE TABLE' and table_name not like 'knex_%'",
  );
  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const { name } of rows) await db.raw('TRUNCATE TABLE ??', [name]);
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
}

/** rofData: the fake ROF's starting state (default: the seed without the demo orders). */
export async function createTestContext({ configOverrides = {}, withRof = false, rofTimeoutMs = 2000, rofData } = {}) {
  const base = loadConfig(process.env);
  const clock = createFakeClock();
  let mockRof = null;
  let rofServer = null;
  let rof = null;
  let config = { ...base, ...configOverrides, databaseUrl: base.testDatabaseUrl };

  if (withRof) {
    mockRof = createMockRofHarness({ now: () => clock.now(), ...(rofData ? { data: rofData } : {}) });
    rofServer = await mockRof.listen();
    const { email, password } = mockRof.store.data.credentials;
    config = { ...config, rof: { ...config.rof, baseUrl: rofServer.baseUrl, email, password, timeoutMs: rofTimeoutMs } };
    rof = createRofClient({ ...config.rof, now: () => clock.now().getTime() });
  }

  const db = createDb(config.databaseUrl);
  await migrateLatest(db);
  const logs = [];
  const logger = {
    info: (...args) => logs.push(['info', args.join(' ')]),
    warn: (...args) => logs.push(['warn', args.join(' ')]),
    error: (...args) => logs.push(['error', args.join(' ')]),
  };
  const ctx = createContext({ config, db, rof, clock, logger });
  const app = createApp(ctx);
  return {
    ctx,
    app,
    db,
    clock,
    logs,
    mockRof,
    reset: () => truncateAll(db),
    close: async () => {
      await db.destroy();
      if (rofServer) await rofServer.close();
    },
  };
}
