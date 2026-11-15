/** Server entry point: config → database → app. */
import { loadConfig } from './config/env.js';
import { createContext } from './context.js';
import { createDb } from './db/knex.js';
import { createApp } from './http/app.js';

const config = loadConfig();
const db = createDb(config.databaseUrl);
const ctx = createContext({ config, db });
const app = createApp(ctx);

app.listen(config.port, () => {
  console.log(`kuraat server listening on http://localhost:${config.port}/api/v1 (ROF: ${config.rof.baseUrl})`);
});
