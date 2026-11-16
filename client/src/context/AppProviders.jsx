import { AuthProvider } from './AuthContext.jsx';
import { ToastProvider } from './ToastContext.jsx';
import { CartProvider } from './CartContext.jsx';
import { FavoritesProvider } from './FavoritesContext.jsx';
import { AddressProvider } from './AddressContext.jsx';
import { OrderProvider } from './OrderContext.jsx';
import { NotificationProvider } from './NotificationContext.jsx';
import { CheckoutProvider } from './CheckoutContext.jsx';
import { CatalogProvider } from './CatalogContext.jsx';
import { BranchProvider } from './BranchContext.jsx';

/** All app state providers, in dependency order. */
export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CatalogProvider>
          <BranchProvider>
            <CartProvider>
              <FavoritesProvider>
                <AddressProvider>
                  <OrderProvider>
                    <NotificationProvider>
                      <CheckoutProvider>{children}</CheckoutProvider>
                    </NotificationProvider>
                  </OrderProvider>
                </AddressProvider>
              </FavoritesProvider>
            </CartProvider>
          </BranchProvider>
        </CatalogProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
