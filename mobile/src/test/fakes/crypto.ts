/** Stand-in for `expo-crypto` in tests (Node's UUIDs). */
import { randomUUID as nodeRandomUUID } from 'node:crypto';

export const randomUUID = (): string => nodeRandomUUID();
