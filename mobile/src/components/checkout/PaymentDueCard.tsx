import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Lock, TriangleAlert } from '@/components/icons';
import { Button, Card, Text } from '@/components/ui';
import { CARD_PAYMENT, formatSAR } from '@/domain';
import { t } from '@/i18n';
import { openPaymentPage } from '@/lib/paymentPage';
import { payOrder } from '@/services/orderService.js';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';

/**
 * "Complete your payment" after an online-payment order is placed. Deliberately simple: Pay opens RSOF's secure
 * payment page in the in-app sheet, and that is all — whether the customer paid is RSOF's business, so nothing is
 * checked or shown here; the text tells them to look at the Orders page. The page comes with the order; when RSOF
 * gave none, one tap gets it.
 */
export function PaymentDueCard({ order, style }: { order: Order; style?: StyleProp<ViewStyle> }) {
  const [link, setLink] = useState<string | null>(order.payment?.link ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = formatSAR(order.total);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError((e as Error).message || t("We couldn't open the payment page. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  const getPage = () => run(async () => setLink(((await payOrder(order.id)) as { link: string }).link));
  const open = () => run(() => openPaymentPage(link as string));

  return (
    <Card style={[styles.card, style]}>
      <Text variant="h3" accessibilityRole="header">
        {CARD_PAYMENT.waitingTitle}
      </Text>
      <Text color="muted" style={styles.body}>
        {CARD_PAYMENT.waitingBody(total)}
      </Text>
      {error ? (
        <View style={styles.alert} accessibilityRole="alert">
          <TriangleAlert size={20} color={colors.hotpink} strokeWidth={1.8} />
          <Text style={styles.alertText}>{error}</Text>
        </View>
      ) : null}
      <Button block leftIcon={Lock} loading={busy} onPress={link ? open : getPage} style={styles.pay}>
        {!link && error ? CARD_PAYMENT.tryAgain : CARD_PAYMENT.pay(total)}
      </Button>
      <Text variant="small" color="muted" style={styles.hint}>
        {CARD_PAYMENT.returnHint}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  body: { marginTop: 4 },
  alert: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(237,59,92,0.4)',
    backgroundColor: 'rgba(237,59,92,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alertText: { flex: 1, fontSize: 15 },
  pay: { marginTop: 16 },
  hint: { marginTop: 12 },
});
