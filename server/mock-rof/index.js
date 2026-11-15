/**
 * npm run mock-rof — runs the fake ROF on MOCK_ROF_PORT (default 8080, the guide's "Local" address).
 * State is saved to mock-rof/data/state.json; delete that file to start again from the seed.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockRof } from './app.js';
import { loadStore } from './store.js';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.MOCK_ROF_PORT || 8080);
const store = loadStore(join(here, 'data', 'state.json'));
const app = createMockRof({ store });

app.listen(port, () => {
  console.log(`Fake ROF listening on http://localhost:${port}`);
  console.log(`  login: ${store.data.credentials.email} / ${store.data.credentials.password}  ·  tenant ${store.data.tenantId}`);
  console.log('  move an order along: npm run mock-rof:advance -- <orderNumber> [Status]');
});

// Demo mode: every N seconds, move each assigned, unfinished order one step along.
const autoSeconds = Number(process.env.MOCK_AUTO_ADVANCE_SECONDS || 0);
if (autoSeconds > 0) {
  setInterval(() => app.locals.advanceAll(), autoSeconds * 1000);
  console.log(`  auto-advance: every ${autoSeconds} s`);
}
