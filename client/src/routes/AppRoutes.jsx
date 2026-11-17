import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell.jsx';
import { GuestOnly, RequireAuth, ScrollToTop } from './guards.jsx';
import SplashPage from '@/pages/auth/SplashPage.jsx';

const WelcomePage = lazy(() => import('@/pages/auth/WelcomePage.jsx'));
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage.jsx'));
const VerifyOtpPage = lazy(() => import('@/pages/auth/VerifyOtpPage.jsx'));
const SetPasswordPage = lazy(() => import('@/pages/auth/SetPasswordPage.jsx'));
const SignInPage = lazy(() => import('@/pages/auth/SignInPage.jsx'));

const HomePage = lazy(() => import('@/pages/shop/HomePage.jsx'));
const ProductDetailPage = lazy(() => import('@/pages/shop/ProductDetailPage.jsx'));
const ImageZoomPage = lazy(() => import('@/pages/shop/ImageZoomPage.jsx'));
const BranchesPage = lazy(() => import('@/pages/shop/BranchesPage.jsx'));

const CartPage = lazy(() => import('@/pages/checkout/CartPage.jsx'));
const DeliveryPage = lazy(() => import('@/pages/checkout/DeliveryPage.jsx'));
const PaymentPage = lazy(() => import('@/pages/checkout/PaymentPage.jsx'));
const PaymentSuccessPage = lazy(() => import('@/pages/checkout/PaymentSuccessPage.jsx'));
const OrderConfirmedPage = lazy(() => import('@/pages/checkout/OrderConfirmedPage.jsx'));

const ProfilePage = lazy(() => import('@/pages/account/ProfilePage.jsx'));
const AccountPage = lazy(() => import('@/pages/account/AccountPage.jsx'));
const PasswordPage = lazy(() => import('@/pages/account/PasswordPage.jsx'));
const OrdersPage = lazy(() => import('@/pages/account/OrdersPage.jsx'));
const OrderDetailPage = lazy(() => import('@/pages/account/OrderDetailPage.jsx'));
const AddressesPage = lazy(() => import('@/pages/account/AddressesPage.jsx'));
const EditAddressPage = lazy(() => import('@/pages/account/EditAddressPage.jsx'));

const NotFoundPage = lazy(() => import('@/pages/NotFoundPage.jsx'));

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<div className="min-h-dvh bg-cream" />}>
        <Routes>
          <Route path="/" element={<SplashPage />} />

          <Route element={<GuestOnly />}>
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/signin" element={<SignInPage />} />
          </Route>
          {/* Reachable signed-in or out — both check for a pending WhatsApp verification */}
          <Route path="/verify" element={<VerifyOtpPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/products/:productId/photos" element={<ImageZoomPage />} />
            <Route element={<AppShell />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/products/:productId" element={<ProductDetailPage />} />
              <Route path="/branches" element={<BranchesPage />} />

              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout/delivery" element={<DeliveryPage />} />
              <Route path="/checkout/payment" element={<PaymentPage />} />
              <Route path="/checkout/success/:orderId" element={<PaymentSuccessPage />} />
              <Route path="/orders/:orderId/confirmed" element={<OrderConfirmedPage />} />

              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/account" element={<AccountPage />} />
              <Route path="/profile/password" element={<PasswordPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:orderId" element={<OrderDetailPage />} />
              <Route path="/addresses" element={<AddressesPage />} />
              <Route path="/addresses/new" element={<EditAddressPage />} />
              <Route path="/addresses/:addressId/edit" element={<EditAddressPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
