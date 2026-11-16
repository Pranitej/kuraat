// Native modules without a JS implementation in Jest.
import 'react-native-gesture-handler/jestSetup';
// FlashList measures its layout natively; its Jest setup gives it a fixed viewport.
import '@shopify/flash-list/jestSetup';
import { setUpTests } from 'react-native-reanimated';

process.env.TZ = 'America/New_York';

// Reanimated 4 in Jest: JS implementations via jest.resolver.js; animations advance with fake timers.
setUpTests();

// Keyboard-aware scroll views: the library's own Jest mock (plain ScrollView).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
