import type { ReactNode } from 'react';
import { AddressProvider } from './AddressContext';
import { AuthProvider } from './AuthContext';
import { BranchProvider } from './BranchContext';
import { CartProvider } from './CartContext';
import { CatalogProvider } from './CatalogContext';
import { CheckoutProvider } from './CheckoutContext';
import { OrderProvider } from './OrderContext';

/** All app data providers, in dependency order (same order as the web's AppProviders). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CatalogProvider>
        <BranchProvider>
          <CartProvider>
            <AddressProvider>
              <OrderProvider>
                <CheckoutProvider>{children}</CheckoutProvider>
              </OrderProvider>
            </AddressProvider>
          </CartProvider>
        </BranchProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
