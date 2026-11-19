/**
 * .env.example is what a new deployment starts from, so it must list every setting the server reads - exactly once -
 * and nothing the server no longer reads. A setting added to src/config/env.js without a line here fails this test.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SETTING_NAMES } from '../../src/config/env.js';

const lines = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8').split(/\r?\n/);
const listed = lines.map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1]).filter(Boolean);

describe('server/.env.example', () => {
  test('lists every setting the server reads', () => {
    expect(SETTING_NAMES.filter((n) => !listed.includes(n))).toEqual([]);
  });

  test('lists nothing the server no longer reads', () => {
    expect(listed.filter((n) => !SETTING_NAMES.includes(n))).toEqual([]);
  });

  test('lists each setting once (the second line would silently win)', () => {
    expect(listed.filter((n, i) => listed.indexOf(n) !== i)).toEqual([]);
  });

  test('holds no real secret: every credential field is empty or an obvious example', () => {
    const secretFields = ['ROF_EMAIL', 'ROF_PASSWORD', 'ROF_API_KEY', 'WHATSAPP_API_USER', 'WHATSAPP_API_PASSWORD', 'WHATSAPP_SENDER', 'WHATSAPP_TEMPLATE_NAME'];
    for (const name of secretFields) {
      const value = lines.find((l) => l.startsWith(`${name}=`))?.slice(name.length + 1);
      expect(value, name).toBe('');
    }
    expect(lines.join('\n')).not.toMatch(/rofi_[0-9a-f]{8}_/);
  });
});
