import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { toBranchView } from '@/domain';
import { listBranches } from '@/services/branchService.js';
import type { Branch } from '@/types/api';
import { useAuth } from './AuthContext';

type State = { branches: Branch[]; status: 'loading' | 'ready' | 'error'; error: unknown };
const EMPTY: State = { branches: [], status: 'loading', error: null };

export type BranchValue = State & { refresh: () => Promise<void>; getBranch: (id: string) => Branch | null };

const BranchContext = createContext<BranchValue | null>(null);

/** Delivery branches, loaded once per session (as `toBranchView` shapes). */
export function BranchProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<State>(EMPTY);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.branches.length ? 'ready' : 'loading', error: null }));
    try {
      const branches = ((await listBranches()) as unknown[]).map(toBranchView) as Branch[];
      setState({ branches, status: 'ready', error: null });
    } catch (error) {
      setState((s) => ({ ...s, status: s.branches.length ? 'ready' : 'error', error }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else setState(EMPTY);
  }, [isAuthenticated, load]);

  const value = useMemo<BranchValue>(() => {
    const byId = new Map(state.branches.map((b) => [b.id, b]));
    return { ...state, refresh: load, getBranch: (id: string) => byId.get(id) || null };
  }, [state, load]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranches(): BranchValue {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranches must be used inside BranchProvider');
  return ctx;
}
