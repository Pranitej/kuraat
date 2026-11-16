import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppProviders from '@/context/AppProviders.jsx';
import AppRoutes from '@/routes/AppRoutes.jsx';
import { local } from '@/lib/storage.js';
import './index.css';

// Data now lives on the server: drop what the old browser-only demo stored.
local.remove('db');
local.remove('session');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
