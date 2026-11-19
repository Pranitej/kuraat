import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { welcomeHero } from '@/assets/images';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { Button, Dialog, Logo, Text, TextLink } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { colors, layout, radii } from '@/theme/theme';
import { t, localized } from '@/i18n';

/** Same copy as the web's Welcome page. */
const LEGAL = localized({
  terms: {
    title: 'Terms of use',
    body: [
      'Orders are prepared fresh by the kuraat branch nearest to your delivery address and delivered within the time slot shown at checkout.',
      'Prices are in Saudi riyals and are shown at checkout before you pay.',
      'You can cancel an order free of charge until the branch starts preparing it. Perishable items cannot be returned once delivered.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      'We use your name, mobile number and delivery addresses only to process and deliver your orders and to send order updates on WhatsApp.',
      'Payment details are handled by our payment provider and are never stored on your device in full.',
      'You can update or delete your account details at any time from your profile.',
    ],
  },
} as const);

/** 02 · Welcome */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [legal, setLegal] = useState<keyof typeof LEGAL | null>(null);
  const doc = legal ? LEGAL[legal] : null;
  const heroHeight = Math.min(470, Math.max(300, height * 0.52));

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.lang, { top: insets.top + 12 }]}>
        <LanguageToggle />
      </View>
      <ScrollView bounces={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeIn.duration(400)} style={{ height: heroHeight }}>
          <Image
            source={welcomeHero}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition={{ left: '50%', top: '40%' }}
            accessibilityLabel={t('kuraat signature maroon truffle box')}
          />
        </Animated.View>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 40 }]}>
          <Animated.View entering={FadeInUp.duration(420)} style={styles.content}>
            <Logo width={132} />
            <Text variant="title" align="center" accessibilityRole="header" style={styles.title}>{t('Welcome to kuraat')}</Text>
            <Text color="muted" align="center" style={styles.subtitle}>{t('Fresh truffles, cakes and pastries, delivered from the branch nearest you.')}</Text>
            <View style={styles.actions}>
              <Button block onPress={() => router.push(ROUTES.signUp)}>{t('Create an account')}</Button>
              <Button block variant="secondary" onPress={() => router.push(ROUTES.signIn)}>{t('Sign in')}</Button>
            </View>
            <Text variant="label" weight={400} color="muted" align="center" style={styles.legal}>{t('By continuing you agree to our')}<TextLink size={13} onPress={() => setLegal('terms')}>{t('Terms')}</TextLink>{t('and')}<TextLink size={13} onPress={() => setLegal('privacy')}>{t('Privacy Policy')}</TextLink>
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      <Dialog open={Boolean(doc)} onClose={() => setLegal(null)} size="md">
        {doc ? (
          <View>
            <Text variant="heading" accessibilityRole="header">
              {doc.title}
            </Text>
            <View style={styles.legalBody}>
              {doc.body.map((p: string) => (
                <Text key={p} color="copy">
                  {p}
                </Text>
              ))}
            </View>
            <Button block onPress={() => setLegal(null)} style={styles.gotIt}>{t('Got it')}</Button>
          </View>
        ) : null}
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  lang: { position: 'absolute', end: 16, zIndex: 20 },
  root: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1 },
  sheet: {
    flexGrow: 1,
    marginTop: -28,
    backgroundColor: colors.cream,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  content: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', alignItems: 'center', paddingHorizontal: 24, paddingTop: 36 },
  title: { marginTop: 20 },
  subtitle: { marginTop: 8, maxWidth: 330 },
  actions: { marginTop: 32, alignSelf: 'stretch', gap: 12 },
  legal: { marginTop: 28 },
  legalBody: { marginTop: 12, gap: 12 },
  gotIt: { marginTop: 24 },
});
