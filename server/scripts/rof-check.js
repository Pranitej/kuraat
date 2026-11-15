/**
 * npm run rof:check [-- --write]
 * Compares the configured ROF (ROF_BASE_URL / ROF_EMAIL / ROF_PASSWORD) with what our adapter expects.
 * --write also creates, assigns, reads and cancels ONE test order (agree with RSOF before using on UAT).
 */
import { loadConfig } from '../src/config/env.js';
import { runRofCheck } from '../src/rof/check.js';

const config = loadConfig();
const write = process.argv.includes('--write');
console.log(`Checking ROF at ${config.rof.baseUrl} as ${config.rof.email}${write ? ' (with --write)' : ''}\n`);
const { ok } = await runRofCheck({ ...config.rof, write });
process.exit(ok ? 0 : 1);
