import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/services/addressService.js';
import { getDb } from '@/services/db.js';
import { useAuth } from './AuthContext.jsx';

const AddressContext = createContext(null);

export function AddressProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  // Initialise synchronously from the local store to avoid a flash; then refresh via the service.
  const [addresses, setAddresses] = useState(() => (userId ? getDb().addresses?.[userId] || [] : []));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return setAddresses([]);
    setLoading(true);
    try {
      setAddresses(await api.listAddresses(userId));
    } finally {
      setLoading(false);
    }
    return undefined;
  }, [userId]);

  useEffect(() => {
    setAddresses(userId ? getDb().addresses?.[userId] || [] : []);
    refresh();
  }, [userId, refresh]);

  const create = useCallback(
    async (input) => {
      const created = await api.createAddress(userId, input);
      await refresh();
      return created;
    },
    [userId, refresh],
  );

  const update = useCallback(
    async (id, input) => {
      const updated = await api.updateAddress(userId, id, input);
      await refresh();
      return updated;
    },
    [userId, refresh],
  );

  const remove = useCallback(
    async (id) => {
      const removed = await api.deleteAddress(userId, id);
      await refresh();
      return removed;
    },
    [userId, refresh],
  );

  const setDefault = useCallback(
    async (id) => {
      await api.setDefaultAddress(userId, id);
      await refresh();
    },
    [userId, refresh],
  );

  const value = useMemo(
    () => ({
      addresses,
      loading,
      refresh,
      create,
      update,
      remove,
      setDefault,
      defaultAddress: addresses.find((a) => a.isDefault) || addresses[0] || null,
      getById: (id) => addresses.find((a) => a.id === id) || null,
    }),
    [addresses, loading, refresh, create, update, remove, setDefault],
  );

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddresses must be used inside AddressProvider');
  return ctx;
}
