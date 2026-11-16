#!/usr/bin/env node
/**
 * Checks that the files shared with the web app are byte-identical (see ../../PARITY.md).
 * Reads parity.json and compares mobile/src/<file> with client/src/<file>.
 *   exit 0  all match (or ../client is not present, e.g. on a build server)
 *   exit 1  a file differs or is missing — fix it in client/, copy it here, run again
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const clientSrc = join(root, '..', 'client', 'src');
const { files } = JSON.parse(readFileSync(join(root, 'parity.json'), 'utf8'));

if (!existsSync(clientSrc)) {
  console.log('parity: skipped — ../client/src not found (only checked inside the full repository).');
  process.exit(0);
}

const problems = [];
for (const file of files) {
  const mine = join(root, 'src', file);
  const theirs = join(clientSrc, file);
  if (!existsSync(theirs)) problems.push(`${file}: missing in client/src`);
  else if (!existsSync(mine)) problems.push(`${file}: missing in mobile/src`);
  else if (!readFileSync(mine).equals(readFileSync(theirs))) problems.push(`${file}: differs from client/src/${file}`);
}

if (problems.length) {
  console.error(`parity: ${problems.length} of ${files.length} shared files are out of sync:`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error('Change the file in client/src, copy it to mobile/src, and run `npm run parity` again.');
  process.exit(1);
}
console.log(`parity: all ${files.length} shared files match client/src.`);
