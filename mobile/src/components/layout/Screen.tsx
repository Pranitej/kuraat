import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, type RefreshControlProps, type ScrollViewInstance, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout } from '@/theme/theme';

/** Scroll position of the current screen (UI thread) — headers use it for the hairline. */
const ScrollYContext = createContext<SharedValue<number> | null>(null);
export const useScreenScrollY = () => useContext(ScrollYContext);

type Props = {
  children: ReactNode;
  /** Fixed header above the content (ScreenHeader handles the status-bar inset itself). */
  header?: ReactNode;
  /** Sticky action bar at the bottom (BottomBar). */
  bottomBar?: ReactNode;
  /** Content scrolls (default). False for screens that render their own list. */
  scroll?: boolean;
  /** Forms: keeps the focused input above the keyboard. */
  keyboard?: boolean;
  /** Horizontal padding: 20 app screens, 24 auth forms, 0 full bleed. */
  gutter?: number;
  /** Pad the top for the status bar when there is no header (false for full-bleed heroes). */
  topInset?: boolean;
  statusBar?: 'dark' | 'light';
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  scrollRef?: Ref<ScrollViewInstance>;
  /** Floating elements over the content (e.g. the cart button), positioned by the caller. */
  overlay?: ReactNode;
  /**
   * Space under the content for the home indicator (default). False when the content ends in a
   * full-bleed panel that handles it itself (Home's maroon footer), so no cream strip shows below.
   */
  padBottom?: boolean;
};

/**
 * Screen frame: status bar, safe areas, cream background, a 640 pt centred column on tablets
 * (web tablet rule), scrolling on the UI thread, keyboard-aware forms and the bottom action bar.
 */
export function Screen({
  children,
  header,
  bottomBar,
  scroll = true,
  keyboard = false,
  gutter = 20,
  topInset = true,
  statusBar = 'dark',
  background = colors.cream,
  contentStyle,
  refreshControl,
  scrollRef,
  overlay,
  padBottom: withBottomPadding = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const padTop = !header && topInset ? insets.top : 0;
  const padBottom = !withBottomPadding ? 0 : bottomBar ? 12 : insets.bottom + 24;
  const column = <View style={[styles.column, { paddingHorizontal: gutter }, contentStyle]}>{children}</View>;

  let body: ReactNode;
  if (!scroll) {
    body = <View style={[styles.flex, { paddingTop: padTop }]}>{children}</View>;
  } else if (keyboard) {
    body = (
      <KeyboardAwareScrollView
        testID="screen-scroll"
        ref={scrollRef as never}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          scrollY.set(e.nativeEvent.contentOffset.y);
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: padTop, paddingBottom: padBottom }}
        refreshControl={refreshControl}
      >
        {column}
      </KeyboardAwareScrollView>
    );
  } else {
    body = (
      <Animated.ScrollView
        testID="screen-scroll"
        ref={scrollRef as never}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: padTop, paddingBottom: padBottom }}
        refreshControl={refreshControl}
      >
        {column}
      </Animated.ScrollView>
    );
  }

  return (
    <ScrollYContext.Provider value={scrollY}>
      <View style={[styles.flex, { backgroundColor: background }]}>
        <StatusBar style={statusBar} />
        {header}
        {body}
        {bottomBar}
        {overlay}
      </View>
    </ScrollYContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
