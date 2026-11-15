/** npm run db:migrate — bring the database in DATABASE_URL up to date. */
import { loadConfig } from '../src/config/env.js';
import { createDb, migrateLatest } from '../src/db/knex.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
try {
  const [batch, names] = await migrateLatest(db);
  console.log(names.length ? `Batch ${batch}: ${names.join(', ')}` : 'Database is up to date.');
} finally {
  await db.destroy();
}
