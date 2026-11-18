import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toBranchView } from '@/domain';
import { listBranches } from '@/services/branchService.js';
import { useAuth } from './AuthContext.jsx';

const BranchContext = createContext(null);
const EMPTY = { branches: [], allBranches: [], status: 'loading', error: null };

/**
 * Branches, loaded once per session (as `toBranchView` shapes): `allBranches` is every branch RSOF has (the
 * branch directory shows them all, with their type); `branches` is only the hubs, which are the delivery branches.
 */
export function BranchProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState(EMPTY);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.branches.length ? 'ready' : 'loading', error: null }));
    try {
      const allBranches = (await listBranches()).map(toBranchView);
      setState({ allBranches, branches: allBranches.filter((b) => b.isHub !== false), status: 'ready', error: null });
    } catch (error) {
      setState((s) => ({ ...s, status: s.branches.length ? 'ready' : 'error', error }));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else setState(EMPTY);
  }, [isAuthenticated, load]);

  const value = useMemo(() => {
    const byId = new Map(state.allBranches.map((b) => [b.id, b]));
    return { ...state, refresh: load, getBranch: (id) => byId.get(id) || null };
  }, [state, load]);

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranches() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error('useBranches must be used inside BranchProvider');
  return ctx;
}
