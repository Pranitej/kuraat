/**
 * Test context: the real app wired to the test database (TEST_DATABASE_URL) and a settable clock.
 * Later tasks extend it with the fake ROF.
 */
import { loadConfig } from '../../src/config/env.js';
import { createDb, migrateLatest } from '../../src/db/knex.js';
import { createContext } from '../../src/context.js';
import { createApp } from '../../src/http/app.js';

export function createFakeClock(start = '2026-11-15T09:21:00.000Z') {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    set: (iso) => { current = new Date(iso).getTime(); },
    advance: (ms) => { current += ms; },
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

export async function createTestContext({ configOverrides = {} } = {}) {
  const base = loadConfig(process.env);
  const config = { ...base, ...configOverrides, databaseUrl: base.testDatabaseUrl };
  const db = createDb(config.databaseUrl);
  await migrateLatest(db);
  const clock = createFakeClock();
  const logs = [];
  const logger = {
    info: (...args) => logs.push(['info', args.join(' ')]),
    warn: (...args) => logs.push(['warn', args.join(' ')]),
    error: (...args) => logs.push(['error', args.join(' ')]),
  };
  const ctx = createContext({ config, db, clock, logger });
  const app = createApp(ctx);
  return {
    ctx,
    app,
    db,
    clock,
    logs,
    reset: () => truncateAll(db),
    close: () => db.destroy(),
  };
}
