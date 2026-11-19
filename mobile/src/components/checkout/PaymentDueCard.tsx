import { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Lock, TriangleAlert } from '@/components/icons';
import { Button, Card, Text } from '@/components/ui';
import { CARD_PAYMENT, formatSAR, usablePaymentLink } from '@/domain';
import { t } from '@/i18n';
import { openPaymentPage } from '@/lib/paymentPage';
import { payOrder } from '@/services/orderService.js';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';

/**
 * "Complete your payment" for an online-payment order that is not paid (right after ordering, and on the order
 * details while RSOF says the payment is open). Deliberately simple: Pay opens RSOF's secure payment page in the
 * in-app sheet, and that is all — whether the customer paid is RSOF's business, so nothing is checked or shown here.
 * `onOrderPage`: the hint says the status updates on this screen (otherwise it points to the Orders page).
 * The page comes with a new order; otherwise ONE tap gets it from the kuraat server and opens it.
 */
export function PaymentDueCard({ order, onOrderPage = false, style }: { order: Order; onOrderPage?: boolean; style?: StyleProp<ViewStyle> }) {
  const [link, setLink] = useState<string | null>(() => usablePaymentLink(order.payment) as string | null); // an expired page is not used: Pay fetches a fresh one
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = formatSAR(order.total);

  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      const page = link ?? ((await payOrder(order.id)) as { link: string }).link;
      setLink(page);
      await openPaymentPage(page);
    } catch (e) {
      setError((e as Error).message || t("We couldn't open the payment page. Please try again."));
    } finally {
      setBusy(false);
    }
  };

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
      <Button block leftIcon={Lock} loading={busy} onPress={pay} style={styles.pay}>
        {!link && error ? CARD_PAYMENT.tryAgain : CARD_PAYMENT.pay(total)}
      </Button>
      <Text variant="small" color="muted" style={styles.hint}>
        {onOrderPage ? CARD_PAYMENT.refreshHint : CARD_PAYMENT.returnHint}
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
