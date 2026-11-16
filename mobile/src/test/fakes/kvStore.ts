/** In-memory stand-in for `expo-sqlite/kv-store` in logic tests (same sync API subset). */
const data = new Map<string, string>();

const Storage = {
  getItemSync: (key: string): string | null => (data.has(key) ? (data.get(key) as string) : null),
  setItemSync: (key: string, value: string): void => {
    data.set(key, value);
  },
  removeItemSync: (key: string): boolean => data.delete(key),
  getAllKeysSync: (): string[] => [...data.keys()],
  __data: data,
};

export default Storage;
