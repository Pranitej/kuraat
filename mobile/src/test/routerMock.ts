/**
 * Jest stand-in for expo-router used by screen tests:
 *   jest.mock('expo-router', () => require('@/test/routerMock').expoRouterMock);
 * Assert navigation through `mockRouter`; set route params with `setMockParams`.
 */
import { createElement, useEffect, type ReactNode } from 'react';
import { Pressable } from 'react-native';

export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  back: jest.fn(),
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(() => true),
};

let params: Record<string, string> = {};
export function setMockParams(next: Record<string, string>): void {
  params = next;
}

export function resetRouterMock(): void {
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockRouter.canGoBack.mockImplementation(() => true);
  params = {};
}

export const expoRouterMock = {
  useRouter: () => mockRouter,
  useLocalSearchParams: () => params,
  useFocusEffect: (effect: () => void | (() => void)) => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(effect, []);
  },
  Redirect: ({ href }: { href: string }) => {
    useEffect(() => {
      mockRouter.replace(href);
    }, [href]);
    return null;
  },
  Link: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement(Pressable, { onPress: () => mockRouter.push(href), accessibilityRole: 'link' }, children),
  Stack: Object.assign(() => null, { Screen: () => null, Protected: () => null }),
};
