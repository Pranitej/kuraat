/**
 * npm run db:seed — add the demo customer (50 123 4821 / Kuraat@2026) if missing and, when the
 * configured ROF has them (the fake ROF does), the PDF's past orders, cart and notifications.
 * Start the fake ROF first (`npm run mock-rof`); against a real ROF the past orders are skipped.
 */
import { DEMO_ORDERS } from '../mock-rof/seed.js';
import { loadConfig } from '../src/config/env.js';
import { createContext } from '../src/context.js';
import { createDb } from '../src/db/knex.js';
import { DEMO_PASSWORD, DEMO_PHONE, seedDemo } from '../src/db/seedDemo.js';
import { createRofClient } from '../src/rof/client.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const silent = { info: () => {}, warn: () => {}, error: (...args) => console.error(...args) };
const ctx = createContext({ config, db, rof: createRofClient(config.rof), logger: silent });
try {
  const result = await seedDemo(db, { hashCost: config.passwordHashCost, ctx, demoOrders: DEMO_ORDERS });
  console.log(result.created ? `Demo customer created: ${DEMO_PHONE} / ${DEMO_PASSWORD}` : 'Demo customer already exists.');
  if (result.ordersAdded) console.log(`Past orders added: ${result.ordersAdded} (with the PDF cart and notifications).`);
  else if (result.skipped) {
    console.log(`Past orders not added: ${result.skipped}.`);
    console.log(`  ROF: ${config.rof.baseUrl}. For the local demo start the fake ROF (npm run mock-rof) and run npm run db:seed again.`);
  } else console.log('Past orders already there.');
} finally {
  await db.destroy();
}
