/** Database access (Knex + mysql2). */
import knex from 'knex';
import { migrations } from '../../migrations/index.js';

export function connectionFromUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    timezone: 'Z',
    decimalNumbers: true,
    charset: 'utf8mb4',
  };
}

export function createDb(databaseUrl) {
  return knex({ client: 'mysql2', connection: connectionFromUrl(databaseUrl), pool: { min: 0, max: 10 } });
}

/** Migrations come from migrations/index.js (no folder scanning, so ESM and bundling never break it). */
const migrationSource = {
  getMigrations: async () => migrations.map((m) => m.name),
  getMigrationName: (name) => name,
  getMigration: async (name) => migrations.find((m) => m.name === name),
};

export const migrateLatest = (db) => db.migrate.latest({ migrationSource });
export const rollbackAll = (db) => db.migrate.rollback({ migrationSource }, true);
