/** Central route map — every screen in the PDF and how to link to it. */
export const ROUTES = {
  splash: '/',
  welcome: '/welcome',
  signUp: '/signup',
  verify: '/verify',
  setPassword: '/set-password',
  signIn: '/signin',

  home: '/home',
  product: (id) => `/products/${id}`,
  productPhotos: (id, index = 0) => `/products/${id}/photos?i=${index}`,

  cart: '/cart',
  delivery: '/checkout/delivery',
  payment: '/checkout/payment',
  paymentSuccess: (orderId) => `/checkout/success/${orderId}`,
  orderConfirmed: (orderId) => `/orders/${orderId}/confirmed`,

  profile: '/profile',
  account: '/profile/account',
  password: '/profile/password',
  orders: '/orders',
  order: (orderId) => `/orders/${orderId}`,
  addresses: '/addresses',
  addressNew: '/addresses/new',
  addressEdit: (id) => `/addresses/${id}/edit`,

  branches: '/branches',
  branch: (id) => `/branches?branch=${id}`,
  notifications: '/notifications',
};

/** Where a notification link opens. */
export function notificationTarget(link) {
  if (!link) return ROUTES.notifications;
  switch (link.kind) {
    case 'order':
      return ROUTES.order(link.id);
    case 'product':
      return ROUTES.product(link.id);
    case 'password':
      return ROUTES.password;
    default:
      return ROUTES.home;
  }
}
