import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toBranchView } from '@/domain';
import { listBranches } from '@/services/branchService.js';
import { useAuth } from './AuthContext.jsx';

const BranchContext = createContext(null);
const EMPTY = { branches: [], status: 'loading', error: null };

/** Delivery branches, loaded once per session (as `toBranchView` shapes). */
export function BranchProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.branches.length ? 'ready' : 'loading', error: null }));
    try {
      const branches = (await listBranches()).map(toBranchView);
      setState({ branches, status: 'ready', error: null });
    } catch (error) {
      setState((s) => ({ ...s, status: s.branches.length ? 'ready' : 'error', error }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else setState(EMPTY);
  }, [isAuthenticated, load]);

  const value = useMemo(() => {
    const byId = new Map(state.branches.map((b) => [b.id, b]));
    return { ...state, refresh: load, getBranch: (id) => byId.get(id) || null };
  }, [state, load]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranches() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranches must be used inside BranchProvider');
  return ctx;
}
