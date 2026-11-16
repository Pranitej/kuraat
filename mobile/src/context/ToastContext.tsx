import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { CircleCheck, Info, TriangleAlert } from '@/components/icons';
import { Text } from '@/components/ui/Text';
import { colors, radii, shadows } from '@/theme/theme';

type Tone = 'success' | 'info' | 'error';
type ToastOptions = { tone?: Tone; action?: { label: string; onPress: () => void } | null; duration?: number };
type ToastState = { id: number; message: string; tone: Tone; action: ToastOptions['action'] };

type ToastApi = { show: (message: string, options?: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);
/** Height of the focused screen's bottom action bar, so toasts float above it (web: --bottom-bar-h). */
const BottomBarContext = createContext<(height: number) => void>(() => {});

const ICONS = { success: CircleCheck, info: Info, error: TriangleAlert };

/** Toast (DESIGN_SYSTEM §E, derived): ink pill above the bottom bar, auto-hides; same timings as the web. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [barHeight, setBarHeight] = useState(0);
  const [multiline, setMultiline] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useContext(SafeAreaInsetsContext);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((message: string, { tone = 'success', action = null, duration = 2800 }: ToastOptions = {}) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setMultiline(false);
    setToast({ id, message, tone, action });
    timer.current = setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), action ? duration + 1800 : duration);
  }, []);

  const api = useMemo(() => ({ show, hide }), [show, hide]);
  const Icon = toast ? ICONS[toast.tone] : null;
  const bottom = (barHeight || insets?.bottom || 0) + 16;

  return (
    <ToastContext.Provider value={api}>
      <BottomBarContext.Provider value={setBarHeight}>
        {children}
        <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
          {toast && Icon ? (
            <Animated.View
              key={toast.id}
              entering={FadeInDown.duration(220)}
              exiting={FadeOut.duration(150)}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[
                styles.toast,
                { backgroundColor: toast.tone === 'error' ? colors.hotpink : colors.ink },
                toast.action ? styles.withAction : null,
                // A message that wraps on a narrow phone turns the pill into a rounded card, so the
                // action button never sits against a half-circle end.
                multiline ? styles.multiline : null,
              ]}
            >
              <Icon size={18} color={toast.tone === 'error' ? colors.white : colors.pink} strokeWidth={2} />
              <Text
                variant="small"
                weight={600}
                color="white"
                style={[styles.message, toast.action ? styles.messageWithAction : null]}
                onTextLayout={(e) => setMultiline(e.nativeEvent.lines.length > 1)}
              >
                {toast.message}
              </Text>
              {toast.action ? (
                <Pressable
                  onPress={() => {
                    toast.action?.onPress();
                    hide();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={toast.action.label}
                  hitSlop={8}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                >
                  <Text variant="small" weight={700} color="white" numberOfLines={1}>
                    {toast.action.label}
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </BottomBarContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

/** BottomBar reports its height here while its screen is focused. */
export const useReportBottomBar = () => useContext(BottomBarContext);

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 20,
    borderRadius: radii.pill,
    ...shadows.dialog,
  },
  // With a button the toast spans the width (max 440): the message gets the room, the button its own.
  withAction: { width: '100%', paddingRight: 8 },
  multiline: { borderRadius: radii.xl, paddingRight: 12 },
  message: { flexShrink: 1 },
  messageWithAction: { flex: 1 },
  // Never squeezed by a long message: the label stays whole on one line.
  action: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  actionPressed: { backgroundColor: 'rgba(255,255,255,0.25)' },
});
