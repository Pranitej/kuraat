import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomBar, Screen, ScreenHeader } from '@/components/layout';
import { MapPin, Pencil, Plus, Store, Trash2 } from '@/components/icons';
import { Button, Card, ConfirmDialog, EmptyState, IconTile, Skeleton, Tag, Text } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatAddress } from '@/domain';
import { radii } from '@/theme/theme';
import type { Address } from '@/types/api';
import { t } from '@/i18n';

/** 23 · Saved addresses */
export default function AddressesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { addresses, remove, loaded } = useAddresses();
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(pendingDelete.id);
      toast.show(`${pendingDelete.label} address deleted`, { tone: 'info' });
      setPendingDelete(null);
    } catch (err) {
      toast.show((err as Error).message, { tone: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const nextDefault = pendingDelete?.isDefault && addresses.length > 1 ? addresses.find((x) => x.id !== pendingDelete.id) : null;

  return (
    <Screen
      header={<ScreenHeader title={t('Saved addresses')} backFallback={ROUTES.profile} />}
      bottomBar={
        <BottomBar>
          <Button block leftIcon={Plus} onPress={() => router.push(ROUTES.addressNew)}>{t('Add new address')}</Button>
        </BottomBar>
      }
    >
      {!loaded ? (
        <View style={styles.list}>
          {[0, 1].map((i) => (
            <Skeleton key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : !addresses.length ? (
        <EmptyState
          icon={MapPin}
          title={t('No saved addresses')}
          message={t('Add an address and we will deliver from the kuraat branch nearest to it.')}
        />
      ) : (
        <View style={styles.list}>
          {addresses.map((a) => (
            <Card key={a.id} style={styles.card}>
              <View style={styles.top}>
                <IconTile icon={a.type === 'office' ? Store : MapPin} size={40} iconSize={19} />
                <Text weight={700} numberOfLines={1} accessibilityRole="header" style={styles.label}>
                  {a.label}
                </Text>
                {a.isDefault ? <Tag tone="dark">{t('Default')}</Tag> : null}
              </View>
              <Text color="copy" style={styles.line}>
                {formatAddress(a)}
              </Text>
              <Text variant="label" weight={400} color="muted" style={styles.contact}>
                {a.contactName || user?.name}
              </Text>
              <View style={styles.actions}>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={Pencil}
                  block
                  accessibilityLabel={t('Edit {label} address', { label: a.label })}
                  onPress={() => router.push(ROUTES.addressEdit(a.id))}
                  style={styles.flex}
                >{t('Edit')}</Button>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={Trash2}
                  block
                  accessibilityLabel={t('Delete {label} address', { label: a.label })}
                  onPress={() => setPendingDelete(a)}
                  style={styles.flex}
                >{t('Delete')}</Button>
              </View>
            </Card>
          ))}
        </View>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        icon={Trash2}
        title={pendingDelete?.label ? t('Delete {label} address?', { label: pendingDelete.label }) : t('Delete this address?')}
        message={
          nextDefault
            ? t('This is your default address. {label} will become your default.', { label: nextDefault.label })
            : pendingDelete
              ? formatAddress(pendingDelete)
              : ''
        }
        confirmLabel={t('Delete address')}
        cancelLabel={t('Keep address')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 12 },
  skeleton: { height: 180, borderRadius: radii.xl },
  card: { padding: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { flex: 1, fontSize: 17, lineHeight: 24 },
  line: { marginTop: 12 },
  contact: { marginTop: 2 },
  actions: { marginTop: 16, flexDirection: 'row', gap: 12 },
});
