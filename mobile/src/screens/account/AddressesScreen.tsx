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
import { formatAddress, formatPhone } from '@/domain';
import { radii } from '@/theme/theme';
import type { Address } from '@/types/api';

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
      header={<ScreenHeader title="Saved addresses" backFallback={ROUTES.profile} />}
      bottomBar={
        <BottomBar>
          <Button block leftIcon={Plus} onPress={() => router.push(ROUTES.addressNew)}>
            Add new address
          </Button>
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
          title="No saved addresses"
          message="Add an address and we will deliver from the kuraat branch nearest to it."
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
                {a.isDefault ? <Tag tone="dark">Default</Tag> : null}
              </View>
              <Text color="copy" style={styles.line}>
                {formatAddress(a)}
              </Text>
              <Text variant="label" weight={400} color="muted" style={styles.contact}>
                {a.contactName || user?.name} · {formatPhone(a.phone)}
              </Text>
              <View style={styles.actions}>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={Pencil}
                  block
                  accessibilityLabel={`Edit ${a.label} address`}
                  onPress={() => router.push(ROUTES.addressEdit(a.id))}
                  style={styles.flex}
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={Trash2}
                  block
                  accessibilityLabel={`Delete ${a.label} address`}
                  onPress={() => setPendingDelete(a)}
                  style={styles.flex}
                >
                  Delete
                </Button>
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
        title={`Delete ${pendingDelete?.label || 'this'} address?`}
        message={
          nextDefault
            ? `This is your default address. ${nextDefault.label} will become your default.`
            : pendingDelete
              ? formatAddress(pendingDelete)
              : ''
        }
        confirmLabel="Delete address"
        cancelLabel="Keep address"
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
