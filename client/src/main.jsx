import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppProviders from '@/context/AppProviders.jsx';
import AppRoutes from '@/routes/AppRoutes.jsx';
import { local, session } from '@/lib/storage.js';
import './index.css';

// Presenter shortcut: open /?reset-demo to restore the original demo data and sign out.
if (new URLSearchParams(window.location.search).has('reset-demo')) {
  local.clearAll();
  session.clearAll();
  window.history.replaceState(null, '', '/');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
