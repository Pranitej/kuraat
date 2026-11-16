import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import type { LucideIcon } from '@/components/icons';
import { colors, motion, radii, shadows } from '@/theme/theme';
import { Button } from './Button';
import { IconTile } from './Surface';
import { Text } from './Text';

type DialogProps = {
  open: boolean;
  /** Scrim tap and Android back. */
  onClose?: () => void;
  /** False while an action runs: scrim and back do nothing. */
  dismissible?: boolean;
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  size?: 'sm' | 'md';
};

/** Centred dialog (PDF screen 16 popup): white, r-sheet 28, padding 24, over the maroon scrim. */
export function Dialog({ open, onClose, dismissible = true, icon, title, children, size = 'sm' }: DialogProps) {
  const close = dismissible ? onClose : undefined;
  return (
    <Modal
      testID="dialog"
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close?.()}
    >
      <View style={styles.center}>
        <Pressable style={styles.scrim} onPress={close} accessible={false} />
        <Animated.View
          entering={ZoomIn.duration(motion.base)}
          style={[styles.panel, { maxWidth: size === 'sm' ? 350 : 480 }]}
          accessibilityViewIsModal
        >
          <ScrollView bounces={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {icon ? (
              <View style={styles.icon}>
                <IconTile icon={icon} size={72} iconSize={30} />
              </View>
            ) : null}
            {title ? (
              <Text align="center" weight={700} accessibilityRole="header" style={[styles.title, icon ? styles.titleAfterIcon : null]}>
                {title}
              </Text>
            ) : null}
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

type ConfirmProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  icon?: LucideIcon;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
};

/** Confirmation built from the popup pattern; stays open while its action runs. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  icon,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading,
}: ConfirmProps) {
  return (
    <Dialog open={open} onClose={onClose} dismissible={!loading} icon={icon} title={title}>
      {message ? (
        <Text color="muted" align="center" style={styles.message}>
          {message}
        </Text>
      ) : null}
      <Button block onPress={onConfirm} loading={loading} style={styles.primary}>
        {confirmLabel}
      </Button>
      <DialogLink label={cancelLabel} onPress={onClose} disabled={loading} />
    </Dialog>
  );
}

/** Text link under a dialog's primary button ("Cancel", "View branch details"). */
export function DialogLink({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Button variant="ghost" size="sm" onPress={onPress} disabled={disabled} style={styles.link}>
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  panel: { width: '100%', maxHeight: '90%', backgroundColor: colors.surface, borderRadius: radii.sheet, ...shadows.dialog },
  content: { padding: 24 },
  icon: { alignItems: 'center' },
  title: { fontSize: 22, lineHeight: 28 },
  titleAfterIcon: { marginTop: 20 },
  message: { marginTop: 8 },
  primary: { marginTop: 24 },
  link: { alignSelf: 'center', marginTop: 8 },
});
