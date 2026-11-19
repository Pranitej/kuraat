/** Server entry point: config → database → ROF client → app → order status poller. */
import { loadConfig } from './config/env.js';
import { createContext } from './context.js';
import { createDb } from './db/knex.js';
import { createApp } from './http/app.js';
import { createOrderPoller } from './jobs/orderPoller.js';
import { createWhatsAppClient } from './messaging/whatsapp.js';
import { createRofClient } from './rof/client.js';
import { createPaymentLinkClient } from './rof/paymentLink.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const rof = createRofClient(config.rof);
// Card payments go through RSOF's payment link; without the key only cash on delivery and pay at branch work.
const paymentLinks = config.rof.apiKey
  ? createPaymentLinkClient({ baseUrl: config.rof.baseUrl, apiKey: config.rof.apiKey, timeoutMs: config.rof.timeoutMs })
  : null;
console.log(`[settings] ROF_API_KEY: ${config.rof.apiKey ? 'set' : 'not set'} · CASH_PAYMENTS_ENABLED: ${config.cashPayments} · OTP_MODE: ${config.otp.mode} · NODE_ENV: ${config.nodeEnv}`);
if (!paymentLinks) {
  console.warn(
    config.cashPayments
      ? 'ROF_API_KEY is not set: online payment is switched off (cash on delivery and pay at branch still work).'
      : 'ROF_API_KEY is not set and cash payments are off: customers cannot pay at all until the key is set.',
  );
}
// Login codes go out on WhatsApp only in OTP_MODE=whatsapp (otherwise the test code is used and nothing is sent).
const whatsapp = config.otp.mode === 'whatsapp' ? createWhatsAppClient(config.whatsapp) : null;
const ctx = createContext({ config, db, rof, paymentLinks, whatsapp });
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
