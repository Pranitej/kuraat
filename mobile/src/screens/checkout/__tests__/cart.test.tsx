import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { session } from '@/lib/storage.js';
import { renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock } from '@/test/routerMock';
import CartScreen from '../CartScreen';
import DeliveryScreen from '../DeliveryScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

const line = (productId: string, name: string, qty: number, warning: string | null = null) => ({
  productId,
  qty,
  product: { id: productId, name, price: 185, images: [] },
  lineTotal: warning ? 0 : 185 * qty,
  available: !warning,
  maxQuantity: 20,
  warning,
});
const cart = (lines: ReturnType<typeof line>[], promo: unknown = null) => ({
  items: lines,
  promo,
  totals: { count: lines.reduce((s, l) => s + l.qty, 0), subtotal: 370, discount: 0, delivery: 15, total: 385, vat: 50.22 },
});
const TWO = cart([line('p1', 'Truffle Box · Classic', 1), line('p2', 'Butter Croissant Box', 2)]);

const ADDRESS = {
  id: 'a1',
  label: 'Home',
  type: 'home',
  line: 'Building 12, Prince Turki St',
  district: 'Al Rakah',
  city: 'Al Khobar',
  postcode: '34227',
  landmark: '',
  phone: '501234821',
  contactName: 'Sara Al-Mutairi',
  location: { lat: 26.2874, lng: 50.2085 },
  isDefault: true,
};


const PICKUP_QUOTE = {
  fulfilment: 'pickup',
  branch: { id: 'b1', name: 'Kuraat · Al Khobar Corniche', address: 'Corniche Rd', city: 'Al Khobar', phone: '+966 13 555 0101', location: { lat: 26.29, lng: 50.22 } },
  distanceKm: 2.4,
  isNearest: true,
  inStock: null,
  totals: { count: 3, subtotal: 370, discount: 0, delivery: 0, total: 370, vat: 48.26 },
};
const pickupServer = (c: { path: string; method: string }) => {
  if (c.path === '/cart' && c.method === 'GET') return { body: TWO };
  if (c.path === '/addresses') return { body: [ADDRESS] };
  if (c.path === '/checkout/quote') return { body: PICKUP_QUOTE };
  return undefined;
};

beforeEach(() => {
  resetRouterMock();
  session.clearAll();
});

describe('12 · Cart', () => {
  test('remove then Undo puts the item back in the same place', async () => {
    await renderScreen(<CartScreen />, { server: (c) => (c.path === '/cart' && c.method === 'GET' ? { body: TWO } : undefined) });
    expect(await screen.findByText('Butter Croissant Box')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove Truffle Box · Classic' }));
    expect(screen.queryByText('Truffle Box · Classic')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    const names = screen.getAllByTestId(/^cart-line-/).map((n) => n.props.testID);
    expect(names).toEqual(['cart-line-p1', 'cart-line-p2']);
  });

  test('there is no promo code field', async () => {
    await renderScreen(<CartScreen />, { server: (c) => (c.path === '/cart' && c.method === 'GET' ? { body: TWO } : undefined) });
    await screen.findByText('Butter Croissant Box');
    expect(screen.queryByLabelText('Promo code')).toBeNull();
  });

  test('an out-of-stock line blocks checkout until it is removed', async () => {
    const blocked = cart([line('p1', 'Truffle Box · Classic', 1, 'out_of_stock')]);
    await renderScreen(<CartScreen />, { server: (c) => (c.path === '/cart' && c.method === 'GET' ? { body: blocked } : undefined) });
    expect(await screen.findByText('Out of stock. Remove it to continue.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue to delivery' })).toBeDisabled();
  });

  test('Continue waits for the cart to be saved, then opens Delivery', async () => {
    const { calls } = await renderScreen(<CartScreen />, {
      server: (c) => (c.path === '/cart' && c.method === 'GET' ? { body: TWO } : undefined),
    });
    await screen.findByText('Butter Croissant Box');
    await fireEvent.press(screen.getAllByLabelText('Increase quantity')[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue to delivery' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/checkout/delivery'));
    expect(calls.some((c) => c.path === '/cart' && c.method === 'PUT')).toBe(true);
  });

  test('empty cart: Start shopping', async () => {
    await renderScreen(<CartScreen />);
    expect(await screen.findByText('Your cart is empty')).toBeTruthy();
  });
});

describe('13 · Delivery details', () => {
  test('with an empty cart it goes back to the cart', async () => {
    await renderScreen(<DeliveryScreen />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/cart'));
  });

  test('the default address is chosen; Continue keeps address + phone and opens Payment', async () => {
    await renderScreen(<DeliveryScreen />, {
      server: (c) => {
        if (c.path === '/cart' && c.method === 'GET') return { body: TWO };
        if (c.path === '/addresses') return { body: [ADDRESS] };
        return undefined;
      },
    });
    expect(await screen.findByRole('radio', { name: /Home/ })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/checkout/payment');
    expect(session.read('checkout')).toMatchObject({ addressId: 'a1', deliveryPhone: '501234821' });
  });

  test('a wrong delivery phone is flagged', async () => {
    await renderScreen(<DeliveryScreen />, {
      server: (c) => {
        if (c.path === '/cart' && c.method === 'GET') return { body: TWO };
        if (c.path === '/addresses') return { body: [ADDRESS] };
        return undefined;
      },
    });
    await screen.findByRole('radio', { name: /Home/ });
    await fireEvent.changeText(screen.getByLabelText('Phone number for this delivery'), '12');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue to payment' }));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  describe('delivery or branch pickup (design 2026-11-18 §5.3)', () => {
    test('the switch offers Delivery and Branch pickup; Pickup hides the address list and shows the note and the phone', async () => {
      await renderScreen(<DeliveryScreen />, { server: pickupServer });
      expect(await screen.findByRole('radio', { name: /Home/ })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Delivery' })).toBeTruthy();
      await fireEvent.press(screen.getByRole('radio', { name: 'Branch pickup' }));
      expect(screen.queryByRole('radio', { name: /Home/ })).toBeNull();
      expect(screen.getByText(/Collect your order from the branch we confirm after you order/)).toBeTruthy();
      expect(screen.getByLabelText('Phone number for this order')).toBeTruthy();
      expect(await screen.findByText('Likely pickup branch')).toBeTruthy();
      expect(screen.getByText('Kuraat · Al Khobar Corniche')).toBeTruthy();
    });

    test('Continue from Pickup goes to Payment with no address and remembers the choice', async () => {
      await renderScreen(<DeliveryScreen />, { server: pickupServer });
      await screen.findByRole('radio', { name: /Home/ });
      await fireEvent.press(screen.getByRole('radio', { name: 'Branch pickup' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Continue to payment' }));
      expect(mockRouter.push).toHaveBeenCalledWith('/checkout/payment');
      expect(session.read('checkout')).toMatchObject({ fulfilment: 'pickup', deliveryPhone: '501234821' });
    });

    test('a wrong phone is still flagged for pickup', async () => {
      await renderScreen(<DeliveryScreen />, { server: pickupServer });
      await screen.findByRole('radio', { name: /Home/ });
      await fireEvent.press(screen.getByRole('radio', { name: 'Branch pickup' }));
      await fireEvent.changeText(screen.getByLabelText('Phone number for this order'), '12');
      await fireEvent.press(screen.getByRole('button', { name: 'Continue to payment' }));
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    test('a remembered cash-on-delivery choice falls back to card when switching to Pickup', async () => {
      session.write('checkout', { fulfilment: 'delivery', addressId: 'a1', deliveryPhone: '501234821', paymentMethod: 'cod', idempotencyKey: null, lastOrderId: null });
      await renderScreen(<DeliveryScreen />, { server: pickupServer });
      await screen.findByRole('radio', { name: /Home/ });
      await fireEvent.press(screen.getByRole('radio', { name: 'Branch pickup' }));
      expect(session.read('checkout')).toMatchObject({ fulfilment: 'pickup', paymentMethod: 'card' });
    });

    test('a draft from before pickup existed is a delivery order', async () => {
      session.write('checkout', { addressId: 'a1', deliveryPhone: '501234821', paymentMethod: 'card', idempotencyKey: null, lastOrderId: null });
      await renderScreen(<DeliveryScreen />, { server: pickupServer });
      expect(await screen.findByRole('radio', { name: /Home/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Delivery' }).props.accessibilityState).toMatchObject({ checked: true });
    });
  });
});
