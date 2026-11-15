/** Server entry point: config → database → ROF client → app. */
import { loadConfig } from './config/env.js';
import { createContext } from './context.js';
import { createDb } from './db/knex.js';
import { createApp } from './http/app.js';
import { createRofClient } from './rof/client.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const rof = createRofClient(config.rof);
const ctx = createContext({ config, db, rof });
const app = createApp(ctx);

app.listen(config.port, () => {
  console.log(`kuraat server listening on http://localhost:${config.port}/api/v1 (ROF: ${config.rof.baseUrl})`);
});
