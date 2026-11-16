import { fireEvent, screen } from '@testing-library/react-native';
import { renderScreen } from '@/test/renderScreen';
import { resetRouterMock, setMockParams } from '@/test/routerMock';
import BranchesScreen from '../BranchesScreen';

jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);

const BRANCHES = [
  {
    id: 'b1',
    name: 'Kuraat · Al Khobar Corniche',
    address: 'Corniche Rd, Al Khobar',
    city: 'Al Khobar',
    phone: '+966 13 555 0101',
    location: { lat: 26.29, lng: 50.22 },
    hours: { open: 10, close: 24 },
    openNow: true,
  },
  {
    id: 'b2',
    name: 'Kuraat · Riyadh Olaya',
    address: 'Olaya St, Riyadh',
    city: 'Riyadh',
    phone: '+966 11 555 0102',
    location: { lat: 24.69, lng: 46.68 },
    hours: { open: 10, close: 24 },
    openNow: false,
  },
];
const server = (c: { path: string }) => (c.path === '/branches' ? { body: BRANCHES } : undefined);

beforeEach(() => resetRouterMock());

describe('25 · Our branches', () => {
  test('lists the branches; a city chip filters them', async () => {
    await renderScreen(<BranchesScreen />, { server });
    expect(await screen.findByText('Al Khobar Corniche')).toBeTruthy();
    expect(screen.getByText('Riyadh Olaya')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Riyadh' }));
    expect(screen.queryByText('Al Khobar Corniche')).toBeNull();
    expect(screen.getByText('Riyadh Olaya')).toBeTruthy();
  });

  test('no match: empty state, and "Show all branches" resets', async () => {
    await renderScreen(<BranchesScreen />, { server });
    await screen.findByText('Al Khobar Corniche');
    await fireEvent.changeText(screen.getByLabelText('Search branches by city or area'), 'Tabuk');
    expect(screen.getByText('No branches found')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Show all branches' }));
    expect(screen.getByText('Al Khobar Corniche')).toBeTruthy();
  });

  test('?branch= highlights that branch (from "View branch details")', async () => {
    setMockParams({ branch: 'b2' });
    await renderScreen(<BranchesScreen />, { server });
    await screen.findByText('Riyadh Olaya');
    expect(screen.getByTestId('branch-b2').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('branch-b1').props.accessibilityState).toMatchObject({ selected: false });
  });

  test('a map pin selects its branch', async () => {
    await renderScreen(<BranchesScreen />, { server });
    await screen.findByText('Riyadh Olaya');
    await fireEvent.press(screen.getByRole('button', { name: 'Show Riyadh Olaya' }));
    expect(screen.getByTestId('branch-b2').props.accessibilityState).toMatchObject({ selected: true });
  });
});
