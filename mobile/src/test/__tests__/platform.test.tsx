import { render, screen } from '@testing-library/react-native';
import { I18nManager } from 'react-native';
import { Text } from '@/components/ui';

describe('Arabic-language phones and large text (review focus 4)', () => {
  test('the root layout keeps the app left-to-right', () => {
    const calls: string[] = [];
    jest.isolateModules(() => {
      // A fresh module registry: spy on the React Native instance the layout will use.
      const { I18nManager: fresh } = require('react-native') as { I18nManager: typeof I18nManager };
      jest.spyOn(fresh, 'allowRTL').mockImplementation((v: boolean) => void calls.push(`allowRTL(${v})`));
      jest.spyOn(fresh, 'forceRTL').mockImplementation((v: boolean) => void calls.push(`forceRTL(${v})`));
      require('@/app/_layout');
    });
    expect(calls).toEqual(['allowRTL(false)', 'forceRTL(false)']);
  });

  test('text scales with the phone setting but is capped at 1.3×', async () => {
    await render(<Text>Your partner for every gathering</Text>);
    expect(screen.getByText('Your partner for every gathering').props.maxFontSizeMultiplier).toBe(1.3);
  });
});
