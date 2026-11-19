import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Lock, TriangleAlert } from '@/components/icons';
import { Button, Card, Text } from '@/components/ui';
import { CARD_PAYMENT, formatSAR } from '@/domain';
import type { OrderPayment } from '@/hooks/orderPayment';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';

/**
 * "Complete your payment" for a card order that is not paid yet (server/README.md → Card payments). Pay opens
 * RSOF's secure payment page in the phone's browser; `payment` comes from useOrderPayment.
 */
export function PaymentDueCard({ order, payment, style }: { order: Order; payment: OrderPayment; style?: StyleProp<ViewStyle> }) {
  const total = formatSAR(order.total);
  const message = payment.error?.message ?? (payment.notYet ? CARD_PAYMENT.notYet : null);
  const canPay = Boolean(payment.link) || !payment.error;
  return (
    <Card style={[styles.card, style]}>
      <Text variant="h3" accessibilityRole="header">
        {CARD_PAYMENT.waitingTitle}
      </Text>
      <Text color="muted" style={styles.body}>
        {CARD_PAYMENT.waitingBody(total)}
      </Text>
      {message ? (
        <View style={styles.alert} accessibilityRole={payment.error ? 'alert' : undefined} accessibilityLiveRegion="polite">
          <TriangleAlert size={20} color={colors.hotpink} strokeWidth={1.8} />
          <Text style={styles.alertText}>{message}</Text>
        </View>
      ) : null}
      {canPay ? (
        <Button block leftIcon={Lock} loading={payment.opening || (!payment.link && payment.checking)} disabled={!payment.link} onPress={payment.open} style={styles.pay}>
          {CARD_PAYMENT.pay(total)}
        </Button>
      ) : (
        <Button block leftIcon={Lock} loading={payment.checking} onPress={payment.check} style={styles.pay}>
          Try again
        </Button>
      )}
      {payment.link ? (
        <Button block variant="secondary" size="md" loading={payment.checking} onPress={payment.check} style={styles.check}>
          {CARD_PAYMENT.check}
        </Button>
      ) : null}
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
  check: { marginTop: 12 },
  hint: { marginTop: 12 },
});
