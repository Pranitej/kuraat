/**
 * The native runtime version (expo-updates "fingerprint" policy) must not depend on settings that
 * live only on this machine. EAS Build recomputes it from the uploaded files — and mobile/.env is
 * gitignored, so it is never uploaded. If the API address changes the runtime version, EAS refuses
 * the build ("Runtime version mismatch", Configure expo-updates phase).
 *
 * Resolves the runtime version twice per variant with different API addresses and fails if they
 * differ. Usage: npm run check:fingerprint
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json'));
const cli = path.join(path.dirname(require.resolve('expo-updates/package.json')), 'bin', 'cli.js');

function runtimeVersion(variant, apiBaseUrl) {
  const r = spawnSync(process.execPath, [cli, 'runtimeversion:resolve', '--platform', 'android'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, APP_VARIANT: variant, EXPO_PUBLIC_API_BASE_URL: apiBaseUrl },
  });
  const line = r.stdout.split('\n').find((l) => l.startsWith('{'));
  if (r.status !== 0 || !line) throw new Error(`runtimeversion:resolve failed (${variant}):\n${r.stderr || r.stdout}`);
  return JSON.parse(line).runtimeVersion;
}

const cases = [
  ['development', 'http://localhost:4000/api/v1', 'http://192.168.1.10:4000/api/v1'],
  ['preview', 'https://uat-a.example.com/api/v1', 'https://uat-b.example.com/api/v1'],
];

let failed = false;
for (const [variant, a, b] of cases) {
  const [ra, rb] = [runtimeVersion(variant, a), runtimeVersion(variant, b)];
  const ok = ra === rb;
  failed ||= !ok;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${variant}: ${ra}${ok ? '' : ` != ${rb}`}`);
}
if (failed) {
  console.error('\nThe API address changes the runtime version — EAS builds would fail with "Runtime version mismatch".');
  process.exit(1);
}
console.log('Runtime version does not depend on the API address.');
