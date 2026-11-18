/** Server entry point: config → database → ROF client → app → order status poller. */
import { loadConfig } from './config/env.js';
import { createContext } from './context.js';
import { createDb } from './db/knex.js';
import { createApp } from './http/app.js';
import { createOrderPoller } from './jobs/orderPoller.js';
import { createWhatsAppClient } from './messaging/whatsapp.js';
import { createRofClient } from './rof/client.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const rof = createRofClient(config.rof);
// Login codes go out on WhatsApp only in OTP_MODE=whatsapp (otherwise the test code is used and nothing is sent).
const whatsapp = config.otp.mode === 'whatsapp' ? createWhatsAppClient(config.whatsapp) : null;
const ctx = createContext({ config, db, rof, whatsapp });
const app = createApp(ctx);
const poller = createOrderPoller({ ctx });

const server = app.listen(config.port, () => {
  console.log(`kuraat server listening on http://localhost:${config.port}/api/v1 (ROF: ${config.rof.baseUrl})`);
  poller.start();
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    poller.stop();
    server.close(() => db.destroy().finally(() => process.exit(0)));
  });
}
