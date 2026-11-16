// Native modules without a JS implementation in Jest.
import 'react-native-gesture-handler/jestSetup';
import { setUpTests } from 'react-native-reanimated';

process.env.TZ = 'America/New_York';

// Reanimated 4 in Jest: JS implementations via jest.resolver.js; animations advance with fake timers.
setUpTests();
