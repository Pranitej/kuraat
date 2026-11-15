import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext.jsx';
import { ROUTES } from '@/config/routes.js';

/** Signed-in only: otherwise go to Welcome, remembering where the user was heading. */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to={ROUTES.welcome} replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Signed-out only (Welcome, Sign up, Sign in). */
export function GuestOnly() {
  const { isAuthenticated } = useAuth();
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
