import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { ROUTES } from '@/config/routes.js';

/** Blank cream screen while the stored session is checked with the server (a moment at start). */
const Restoring = () => <div className="min-h-dvh bg-cream" aria-busy="true" />;

/** Signed-in only: otherwise go to Welcome, remembering where the user was heading. */
export function RequireAuth() {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();
  if (status === 'restoring') return <Restoring />;
  if (!isAuthenticated) return <Navigate to={ROUTES.welcome} replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Signed-out only (Welcome, Sign up, Sign in). */
export function GuestOnly() {
  const { isAuthenticated, status } = useAuth();
  if (status === 'restoring') return <Restoring />;
  if (isAuthenticated) return <Navigate to={ROUTES.home} replace />;
  return <Outlet />;
}

/** Scroll to top on every page change (keeps position on back/forward). */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
