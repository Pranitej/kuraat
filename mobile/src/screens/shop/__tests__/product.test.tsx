import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderScreen } from '@/test/renderScreen';
import { mockRouter, resetRouterMock, setMockParams } from '@/test/routerMock';
import ImageZoomScreen from '../ImageZoomScreen';
import ProductDetailScreen from '../ProductDetailScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

beforeEach(() => {
  resetRouterMock();
  setMockParams({ productId: 'p1' });
});

describe('09/10 · Product detail', () => {
  test('Buy now adds the chosen quantity and opens the cart', async () => {
    const { calls } = await renderScreen(<ProductDetailScreen />);
    expect(await screen.findByRole('header', { name: 'Truffle Box · Classic' })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Increase quantity'));
    await fireEvent.press(screen.getByRole('button', { name: 'Buy now' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/cart');
    await waitFor(() =>
      expect(calls.find((c) => c.path === '/cart' && c.method === 'PUT')?.body).toEqual({
        items: [{ productId: 'p1', qty: 2 }],
        promoCode: null,
      }),
    );
  });

  test('on a tablet the photos fill the 640 pt column, not the whole window', async () => {
    const dims = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 1024, height: 1366, scale: 2, fontScale: 1 });
    await renderScreen(<ProductDetailScreen />);
    const photo = await screen.findByTestId('hero-photo-0');
    expect(photo.props.style).toMatchObject({ width: 640 });
    dims.mockRestore();
  });

  test('Read more shows the full description', async () => {
    await renderScreen(<ProductDetailScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Read more' }));
    expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull();
  });
});

describe('11 · Image zoom', () => {
  test('zoom buttons step 100 % → 125 % and fit returns to 100 %', async () => {
    await renderScreen(<ImageZoomScreen />);
    expect(await screen.findByText('100%')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Zoom in' })[0]);
    expect(await screen.findByText('125%')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Fit to screen' }));
    expect(await screen.findByText('100%')).toBeTruthy();
  });

  test('close goes back to the product', async () => {
    await renderScreen(<ImageZoomScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Close' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
