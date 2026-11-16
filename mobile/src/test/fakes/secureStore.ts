/** In-memory stand-in for `expo-secure-store` in logic tests; records calls. */
export const __data = new Map<string, string>();
export const __calls: string[] = [];

export const AFTER_FIRST_UNLOCK = 0;

export function getItem(key: string): string | null {
  __calls.push(`get:${key}`);
  return __data.has(key) ? (__data.get(key) as string) : null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  __calls.push(`set:${key}`);
  __data.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  __calls.push(`delete:${key}`);
  __data.delete(key);
}
