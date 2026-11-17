import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '@/components/layout';
import { ChevronRight, Heart, KeyRound, LogOut, MapPin, ReceiptText, User } from '@/components/icons';
import { Avatar, Button, ConfirmDialog, IconTile, MaroonPanel, Text } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { useAddresses } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useFavorites } from '@/context/FavoritesContext';
import { useToast } from '@/context/ToastContext';
import { formatPhone } from '@/domain';
import { colors, layout, radii } from '@/theme/theme';

const favoritesSubtitle = (n: number) => (n ? `${n} saved ${n === 1 ? 'sweet' : 'sweets'}` : 'Sweets you save with the heart');

/** 17 · Profile (+ Favourites, added after the PDF) */
export default function ProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { addresses } = useAddresses();
  const { ids: favoriteIds } = useFavorites();
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const items: { to: Href; icon: typeof User; title: string; subtitle: string }[] = [
    { to: ROUTES.account, icon: User, title: 'Account', subtitle: 'Name, phone number, gender' },
    { to: ROUTES.password, icon: KeyRound, title: 'Password', subtitle: 'Set or change your password' },
    { to: ROUTES.orders, icon: ReceiptText, title: 'Orders', subtitle: 'View your previous orders' },
    { to: ROUTES.favorites, icon: Heart, title: 'Favourites', subtitle: favoritesSubtitle(favoriteIds.length) },
    {
      to: ROUTES.addresses,
      icon: MapPin,
      title: 'Saved addresses',
      subtitle: `${addresses.length} saved ${addresses.length === 1 ? 'address' : 'addresses'}`,
    },
  ];

  const logOut = async () => {
    setLeaving(true);
    await signOut();
    toast.show('You have been logged out', { tone: 'info' });
    router.replace(ROUTES.welcome);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <MaroonPanel style={[styles.header, { paddingTop: insets.top + layout.headerTop }]}>
          <View style={styles.column}>
            <View style={styles.titleRow}>
              <BackButton variant="glass" fallback={ROUTES.home} />
              <Text variant="heading" color="white" accessibilityRole="header" style={styles.title}>
                Profile
              </Text>
              <View style={styles.spacer} />
            </View>
            <View style={styles.who}>
              <Avatar name={user?.name} src={user?.avatar} size={76} tone="cream" />
              <View style={styles.flex}>
                <Text weight={700} color="white" numberOfLines={1} style={styles.name}>
                  {user?.name}
                </Text>
                <Text color="white80" style={styles.phone}>
                  {formatPhone(user?.phone)}
                </Text>
              </View>
            </View>
          </View>
        </MaroonPanel>

        <View style={styles.sheet}>
          <View style={[styles.column, styles.menu]}>
            {items.map((item) => (
              <Pressable
                key={item.title}
                onPress={() => router.push(item.to)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.subtitle}`}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <IconTile icon={item.icon} />
                <View style={styles.flex}>
                  <Text weight={700} style={styles.itemTitle}>
                    {item.title}
                  </Text>
                  <Text variant="small" color="muted" numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.ink} strokeWidth={1.8} />
              </Pressable>
            ))}
            <Button variant="secondary" block leftIcon={LogOut} onPress={() => setConfirm(true)} style={styles.logout}>
              Log out
            </Button>
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={logOut}
        loading={leaving}
        icon={LogOut}
        title="Log out of kuraat?"
        message="Your cart and saved addresses will be here when you sign back in."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1, minWidth: 0 },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: 20 },
  header: { paddingBottom: 56 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, textAlign: 'center' },
  spacer: { width: 44 },
  who: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontSize: 22, lineHeight: 28 },
  phone: { marginTop: 2 },
  sheet: { marginTop: -28, borderTopLeftRadius: radii.sheet, borderTopRightRadius: radii.sheet, backgroundColor: colors.cream },
  menu: { paddingTop: 28, gap: 12 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    backgroundColor: colors.surface,
    padding: 16,
  },
  itemPressed: { borderColor: colors.line },
  itemTitle: { fontSize: 16, lineHeight: 22 },
  logout: { marginTop: 8 },
});
