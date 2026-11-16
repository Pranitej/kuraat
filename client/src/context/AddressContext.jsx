import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '@/services/addressService.js';
import { useAuth } from './AuthContext.jsx';

const AddressContext = createContext(null);

/** The customer's saved addresses (server). `loaded` turns true after the first answer. */
export function AddressProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAddresses([]);
      return;
    }
    setLoading(true);
    try {
      setAddresses(await api.listAddresses());
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setAddresses([]);
    setLoaded(false);
    refresh().catch(() => setLoaded(true));
  }, [refresh]);

  const create = useCallback(
    async (input) => {
      const created = await api.createAddress(input);
      await refresh();
      return created;
    },
    [refresh],
  );

  const update = useCallback(
    async (id, input) => {
      const updated = await api.updateAddress(id, input);
      await refresh();
      return updated;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id) => {
      await api.deleteAddress(id);
      await refresh();
    },
    [refresh],
  );

  const setDefault = useCallback(async (id) => {
    setAddresses(await api.setDefaultAddress(id));
  }, []);

  const value = useMemo(
    () => ({
      addresses,
      loading,
      loaded,
      refresh,
      create,
      update,
      remove,
      setDefault,
      defaultAddress: addresses.find((a) => a.isDefault) || addresses[0] || null,
      getById: (id) => addresses.find((a) => a.id === id) || null,
    }),
    [addresses, loading, loaded, refresh, create, update, remove, setDefault],
  );

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddresses must be used inside AddressProvider');
  return ctx;
}
