import { AuthProvider } from './AuthContext.jsx';
import { ToastProvider } from './ToastContext.jsx';
import { CartProvider } from './CartContext.jsx';
import { AddressProvider } from './AddressContext.jsx';
import { OrderProvider } from './OrderContext.jsx';
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
              <AddressProvider>
                <OrderProvider>
                  <CheckoutProvider>{children}</CheckoutProvider>
                </OrderProvider>
              </AddressProvider>
            </CartProvider>
          </BranchProvider>
        </CatalogProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
