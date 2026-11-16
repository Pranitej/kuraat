import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '@/services/addressService.js';
import type { Address } from '@/types/api';
import { useAuth } from './AuthContext';

/** What the address form sends (addressService.toAddressBody turns it into the request). */
export type AddressInput = Partial<Omit<Address, 'id'>> & { type: Address['type']; city: string; line: string };

export type AddressValue = {
  addresses: Address[];
  loading: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  create: (input: AddressInput) => Promise<Address>;
  update: (id: string, input: AddressInput) => Promise<Address>;
  remove: (id: string) => Promise<void>;
  setDefault: (id: string) => Promise<void>;
  defaultAddress: Address | null;
  getById: (id: string) => Address | null;
};

const AddressContext = createContext<AddressValue | null>(null);

/** The customer's saved addresses (server). `loaded` turns true after the first answer. */
export function AddressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [addresses, setAddresses] = useState<Address[]>([]);
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
    async (input: AddressInput) => {
      const created: Address = await api.createAddress(input);
      await refresh();
      return created;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, input: AddressInput) => {
      const updated: Address = await api.updateAddress(id, input);
      await refresh();
      return updated;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await api.deleteAddress(id);
      await refresh();
    },
    [refresh],
  );

  const setDefault = useCallback(async (id: string) => {
    setAddresses(await api.setDefaultAddress(id));
  }, []);

  const value = useMemo<AddressValue>(
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
      getById: (id: string) => addresses.find((a) => a.id === id) || null,
    }),
    [addresses, loading, loaded, refresh, create, update, remove, setDefault],
  );

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddresses(): AddressValue {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddresses must be used inside AddressProvider');
  return ctx;
}
