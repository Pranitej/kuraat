#!/usr/bin/env node
/**
 * npm run dev (from the repo root) — brings up the whole local stack, in order:
 *
 *   1. MySQL in Docker (starts Docker Desktop if needed, waits until the container is healthy)
 *   2. database migrations                         (server: npm run db:migrate)
 *   3. API                      :4000/api/v1      (server: npm run dev — talks to the real RSOF set in server/.env)
 *   4. web app                  :5173             (client: npm run dev)
 *   5. Expo for the phone       :8081             (mobile: npm start, or start:dev-client)
 *
 * Anything already running is left alone, so running it twice is safe. Each long-running server
 * opens in its own Windows Terminal tab (one "kuraat" window); close a tab to stop that server.
 * Without Windows Terminal (or with --inline) they run here with [name] prefixes; Ctrl+C stops them.
 *
 * There is no local stand-in for RSOF: the stack always uses the RSOF in server/.env (ROF_BASE_URL, ROF_EMAIL,
 * ROF_PASSWORD), so the shop shows RSOF's own products and is only as full as RSOF's stock.
 *
 * Options:  --dev-client  Expo for the EAS dev build instead of Expo Go
 *           --no-expo     skip Expo        --no-web   skip the web app
 *           --inline      everything in this terminal

 *
 * Zero dependencies on purpose: the root is not an app (each of client/, mobile/, server/ is
 * installed and run on its own). Ports and addresses come from server/.env and mobile/.env.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = { server: join(ROOT, 'server'), client: join(ROOT, 'client'), mobile: join(ROOT, 'mobile') };
const args = new Set(process.argv.slice(2));
const isWin = process.platform === 'win32';

if (args.has('--help') || args.has('-h')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*?|^ \* ?/gm, ''));
  process.exit(0);
}

// ── output ──────────────────────────────────────────────────────────────────────────────
const tint = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = { dim: tint('2'), bold: tint('1'), green: tint('32'), yellow: tint('33'), red: tint('31'), cyan: tint('36'), magenta: tint('35') };
const step = (msg) => console.log(`${c.cyan('›')} ${msg}`);
const ok = (msg) => console.log(`${c.green('✓')} ${msg}`);
const warn = (msg) => console.log(`${c.yellow('!')} ${msg}`);
const fail = (msg, hint) => {
  console.error(`${c.red('✗')} ${msg}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
};

// ── settings from the apps' own .env files ────────────────────────────────────────────────
function readEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}
const serverEnv = readEnv(join(DIR.server, '.env'));
const mobileEnv = readEnv(join(DIR.mobile, '.env'));
const PORTS = {
  api: Number(serverEnv.PORT || 4000),
  web: 5173,
  expo: 8081,
};

// ── small helpers ───────────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Something accepts connections on localhost:port (IPv4 or IPv6). */
function portOpen(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host });
      const done = (open) => {
        socket.destroy();
        resolve(open);
      };
      socket.setTimeout(800, () => done(false));
      socket.once('connect', () => done(true));
      socket.once('error', () => done(false));
    });
  return tryHost('127.0.0.1').then((open) => open || tryHost('::1'));
}

async function waitFor(check, { what, seconds = 60, hint }) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    if (await check()) return;
    await sleep(1000);
  }
  fail(`${what} did not come up within ${seconds} s.`, hint);
}

async function apiHealthy() {
  try {
    const res = await fetch(`http://localhost:${PORTS.api}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Runs a command to completion in `cwd`, output shown here. */
function run(label, command, cwd) {
  step(label);
  const res = spawnSync(command, { cwd, stdio: 'inherit', shell: true });
  if (res.status !== 0) fail(`${label} failed (exit ${res.status}).`);
}

function quiet(command, argv) {
  return spawnSync(command, argv, { encoding: 'utf8', shell: false });
}

// ── long-running servers: a Windows Terminal tab each, or inline with a prefix ───────────
const hasWindowsTerminal = isWin && !args.has('--inline') && quiet('where', ['wt.exe']).status === 0;
const inlineChildren = [];

function launch({ name, cwd, command, colour }) {
  if (hasWindowsTerminal) {
    // A named window ("kuraat") collects every tab; -NoExit keeps a crashed server's error visible.
    const child = spawn(
      'wt.exe',
      ['-w', 'kuraat', 'new-tab', '--title', name, '-d', cwd, 'powershell.exe', '-NoLogo', '-NoExit', '-Command', command],
      { detached: true, stdio: 'ignore' },
    );
    child.unref();
    return;
  }
  const child = spawn(command, { cwd, shell: true, stdio: ['inherit', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  const tag = colour(`[${name}]`.padEnd(12));
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) out.write(`${tag} ${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => console.log(`${tag} exited (${code ?? 'signal'})`));
  inlineChildren.push(child);
}

const stopInline = () => {
  for (const child of inlineChildren) {
    if (child.exitCode !== null) continue;
    if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else child.kill('SIGINT');
  }
  process.exit(0);
};
process.on('SIGINT', stopInline);

/** Starts `name` unless its port already answers; then waits until it does. */
async function server({ name, port, cwd, command, colour, ready = () => portOpen(port), seconds = 60, hint }) {
  if (await ready()) {
    ok(`${name} already running on :${port} — left as is`);
    return 'running';
  }
  step(`Starting ${name} on :${port}${hasWindowsTerminal ? ' (new tab)' : ''}`);
  launch({ name, cwd, command, colour });
  await waitFor(ready, { what: name, seconds, hint: hint || (hasWindowsTerminal ? `Look at the "${name}" tab for the error.` : undefined) });
  ok(`${name} is up`);
  return 'started';
}

// ── preflight ───────────────────────────────────────────────────────────────────────────
const wantWeb = !args.has('--no-web');
const wantExpo = !args.has('--no-expo');

for (const [app, dir] of Object.entries(DIR)) {
  if ((app === 'client' && !wantWeb) || (app === 'mobile' && !wantExpo)) continue;
  if (!existsSync(join(dir, 'node_modules'))) fail(`${app}/ has no node_modules.`, `Run: cd ${app} && npm install`);
}
if (!existsSync(join(DIR.server, '.env'))) fail('server/.env is missing.', 'Run: cd server && cp .env.example .env');
if (!serverEnv.ROF_BASE_URL || !serverEnv.ROF_EMAIL || !serverEnv.ROF_PASSWORD) {
  fail('server/.env has no RSOF settings yet.', 'Set ROF_BASE_URL, ROF_EMAIL and ROF_PASSWORD in server/.env (see server/.env.example; ask RSOF for the login).');
}

console.log(c.bold('\nkuraat — starting the local stack\n'));

// ── 1. Docker + MySQL ───────────────────────────────────────────────────────────────────
const dockerUp = () => quiet('docker', ['info', '--format', '{{.ServerVersion}}']).status === 0;
if (quiet('docker', ['--version']).status !== 0) fail('Docker is not installed (needed for MySQL).', 'Install Docker Desktop, or point DATABASE_URL at another MySQL 8.');
if (!dockerUp()) {
  const desktop = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
  if (isWin && existsSync(desktop)) {
    step('Starting Docker Desktop (can take a minute)');
    spawn(desktop, [], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    step('Starting Docker Desktop (can take a minute)');
    spawnSync('open', ['-a', 'Docker']);
  } else {
    fail('Docker is not running.', 'Start Docker, then run this again.');
  }
  await waitFor(async () => dockerUp(), { what: 'Docker', seconds: 180, hint: 'Open Docker Desktop and check it finishes starting.' });
  ok('Docker is running');
}

const health = () => quiet('docker', ['inspect', '-f', '{{.State.Health.Status}}', 'kuraat-mysql']).stdout?.trim();
if (health() === 'healthy') ok('MySQL (kuraat-mysql) already running on :3307');
else {
  run('Starting MySQL (docker compose up -d)', 'docker compose up -d', DIR.server);
  await waitFor(async () => health() === 'healthy', { what: 'MySQL', seconds: 120, hint: 'Check: cd server && docker compose logs mysql' });
  ok('MySQL is healthy on :3307');
}

// ── 2. migrations ──────────────────────────────────────────────────────────────────────
run('Database migrations', 'npm run --silent db:migrate', DIR.server);

// ── 3. API ─────────────────────────────────────────────────────────────────────────────
await server({ name: 'API', port: PORTS.api, cwd: DIR.server, command: 'npm run dev', colour: c.green, ready: apiHealthy });

// ── 4. web app ─────────────────────────────────────────────────────────────────────────
if (wantWeb) await server({ name: 'Web', port: PORTS.web, cwd: DIR.client, command: 'npm run dev', colour: c.cyan });

// ── 5. Expo ────────────────────────────────────────────────────────────────────────────
if (wantExpo) {
  const expoCommand = args.has('--dev-client') ? 'npm run start:dev-client' : 'npm start';
  await server({ name: 'Expo', port: PORTS.expo, cwd: DIR.mobile, command: expoCommand, colour: c.yellow, seconds: 90 });
}

// ── phone address check: the phone reaches the laptop on its Wi-Fi IP ─────────────────
const lanIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === 'IPv4' && !i.internal)
  .map((i) => i.address);
const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};
const phoneApiHost = hostOf(mobileEnv.EXPO_PUBLIC_API_BASE_URL);
if (wantExpo && phoneApiHost && phoneApiHost !== 'localhost' && !lanIps.includes(phoneApiHost)) {
  warn(`mobile/.env points the phone at ${phoneApiHost}, but this laptop's IP is now ${lanIps.join(' / ') || 'unknown'}.`);
  warn('Update EXPO_PUBLIC_API_BASE_URL in mobile/.env, then restart Expo.');
}

// ── summary ────────────────────────────────────────────────────────────────────────────
const lan = phoneApiHost && lanIps.includes(phoneApiHost) ? phoneApiHost : lanIps[0];
const rows = [
  ['Web app', `http://localhost:${PORTS.web}`, wantWeb],
  ['API', `http://localhost:${PORTS.api}/api/v1`, true],
  ['RSOF', serverEnv.ROF_BASE_URL, true],
  ['MySQL', 'localhost:3307 (kuraat / kuraat)', true],
  ['Expo (phone)', lan ? `exp://${lan}:${PORTS.expo}` : `port ${PORTS.expo}`, wantExpo],
].filter((r) => r[2]);
console.log(`\n${c.bold('All up:')}`);
for (const [name, url] of rows) console.log(`  ${name.padEnd(13)} ${c.cyan(url)}`);
console.log(c.dim('\n  Test logins: your local TEST_CREDENTIALS.md'));
if (hasWindowsTerminal) {
  console.log(c.dim('  Each server runs in its own tab of the "kuraat" Windows Terminal window — close a tab to stop it.'));
  console.log(c.dim('  MySQL keeps running in Docker; stop it with: cd server && docker compose stop\n'));
} else if (inlineChildren.length) {
  console.log(c.dim('  Ctrl+C stops the servers started here (MySQL keeps running in Docker).\n'));
} else {
  console.log('');
}
