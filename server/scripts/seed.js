/** npm run db:seed — add the demo customer (50 123 4821 / Kuraat@2026) if missing. */
import { loadConfig } from '../src/config/env.js';
import { createDb } from '../src/db/knex.js';
import { DEMO_PASSWORD, DEMO_PHONE, seedDemo } from '../src/db/seedDemo.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
try {
  const { created } = await seedDemo(db, { hashCost: config.passwordHashCost });
  console.log(created ? `Demo customer created: ${DEMO_PHONE} / ${DEMO_PASSWORD}` : 'Demo customer already exists.');
} finally {
  await db.destroy();
}
