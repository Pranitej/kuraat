/**
 * Environment configuration. Every setting the server reads from the environment is declared and
 * validated here, so a missing or wrong value fails at start-up with a clear message.
 */
import { z } from 'zod';
import { PROMO_CODES } from './business.js';

const blankToUndefined = (value) => (value === '' ? undefined : value);
const text = () => z.preprocess(blankToUndefined, z.string().trim().min(1));
const optionalText = () => z.preprocess(blankToUndefined, z.string().trim().min(1).optional());
const flag = (fallback) =>
  z
    .preprocess(blankToUndefined, z.enum(['true', 'false', '1', '0']).optional())
    .transform((v) => (v === undefined ? fallback : v === 'true' || v === '1'));
const integer = (fallback) => z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(fallback));

const schema = z.object({
  PORT: integer(4000),
  NODE_ENV: z.preprocess(blankToUndefined, z.enum(['development', 'test', 'production']).default('development')),
  DATABASE_URL: text().pipe(z.string().startsWith('mysql://', 'must start with mysql://')),
  TEST_DATABASE_URL: optionalText(),
  JWT_ACCESS_SECRET: text().pipe(z.string().min(32, 'must be at least 32 characters')),
  JWT_REFRESH_SECRET: text().pipe(z.string().min(32, 'must be at least 32 characters')),
  CORS_ORIGINS: z.preprocess(blankToUndefined, z.string().default('http://localhost:5173')),
  ROF_BASE_URL: text().pipe(z.url()),
  // Where the apps load RSOF's product photos from; defaults to ROF_BASE_URL. Locally a phone
  // cannot use "localhost": set it to the laptop's Wi-Fi address (e.g. http://192.168.1.10:8080).
  ROF_MEDIA_BASE_URL: z.preprocess(blankToUndefined, z.url().optional()),
  ROF_EMAIL: text(),
  ROF_PASSWORD: text(),
  ROF_INVENTORY_CHECK: flag(false),
  ROF_TIMEOUT_MS: integer(10000),
  OTP_MODE: z.preprocess(blankToUndefined, z.enum(['test', 'whatsapp']).default('test')),
  OTP_TEST_CODE: z.preprocess(blankToUndefined, z.string().regex(/^\d{6}$/, 'must be 6 digits').default('123456')),
  PRICES_INCLUDE_VAT: flag(true),
  ORDER_POLL_INTERVAL_MS: integer(60000),
  PASSWORD_HASH_COST: z.preprocess(blankToUndefined, z.coerce.number().int().min(4).max(15).default(12)),
  AUTH_RATE_LIMIT_PER_MINUTE: integer(20),
  OTP_ALLOW_TEST_IN_PRODUCTION: flag(false),
  PAYMENTS_ALLOW_SIMULATED_IN_PRODUCTION: flag(false),
  /** Express "trust proxy": e.g. 1 behind one reverse proxy / load balancer. Unset = do not trust. */
  TRUST_PROXY: optionalText(),
});

const TEST_OTP_IN_PRODUCTION =
  'OTP_MODE=test lets anyone sign in to any account with the test code. In production use it only for UAT, ' +
  'by also setting OTP_ALLOW_TEST_IN_PRODUCTION=true.';

const SIMULATED_PAYMENTS_IN_PRODUCTION =
  'Card payments are simulated (no payment gateway is connected yet): any valid-looking test card is "paid" and no money moves. ' +
  'In production start only for a demo or UAT, by also setting PAYMENTS_ALLOW_SIMULATED_IN_PRODUCTION=true.';

/** Validated settings object used across the server. */
export function loadConfig(env = process.env) {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const e = result.data;
  if (e.NODE_ENV === 'production' && e.OTP_MODE === 'test' && !e.OTP_ALLOW_TEST_IN_PRODUCTION) {
    throw new Error(`Invalid configuration: ${TEST_OTP_IN_PRODUCTION}`);
  }
  if (e.NODE_ENV === 'production' && !e.PAYMENTS_ALLOW_SIMULATED_IN_PRODUCTION) {
    throw new Error(`Invalid configuration: ${SIMULATED_PAYMENTS_IN_PRODUCTION}`);
  }
  return {
    port: e.PORT,
    nodeEnv: e.NODE_ENV,
    databaseUrl: e.DATABASE_URL,
    testDatabaseUrl: e.TEST_DATABASE_URL ?? null,
    corsOrigins: e.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    jwt: { accessSecret: e.JWT_ACCESS_SECRET, refreshSecret: e.JWT_REFRESH_SECRET, accessTtlSec: 900, refreshTtlDays: 30 },
    rof: {
      baseUrl: e.ROF_BASE_URL.replace(/\/+$/, ''),
      mediaBaseUrl: (e.ROF_MEDIA_BASE_URL || e.ROF_BASE_URL).replace(/\/+$/, ''),
      email: e.ROF_EMAIL,
      password: e.ROF_PASSWORD,
      inventoryCheck: e.ROF_INVENTORY_CHECK,
      timeoutMs: e.ROF_TIMEOUT_MS,
    },
    otp: { mode: e.OTP_MODE, testCode: e.OTP_TEST_CODE },
    promos: PROMO_CODES,
    pricesIncludeVat: e.PRICES_INCLUDE_VAT,
    pollIntervalMs: e.ORDER_POLL_INTERVAL_MS,
    passwordHashCost: e.PASSWORD_HASH_COST,
    authRateLimitPerMinute: e.AUTH_RATE_LIMIT_PER_MINUTE,
    trustProxy: e.TRUST_PROXY ?? false,
  };
}
