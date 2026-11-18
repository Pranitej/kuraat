import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Fragment, memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Check, Store, Trash2 } from '@/components/icons';
import { Card, IconButton, Stepper, SummaryRow, Text } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import type { CartLine } from '@/context/CartContext';
import { formatSAR, lineWarning } from '@/domain';
import { colors, radii } from '@/theme/theme';
import type { Totals } from '@/types/api';

const STEPS = ['Cart', 'Delivery', 'Payment'];

/** 1 Cart —— 2 Delivery —— 3 Payment */
export function CheckoutSteps({ current }: { current: number }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Checkout step ${current + 1} of 3: ${STEPS[current]}`}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={label}>
            <View style={styles.step}>
              <View style={[styles.stepDot, { backgroundColor: done || active ? colors.maroon : colors.sand }]}>
                {done ? (
                  <Check size={14} color={colors.white} strokeWidth={3} />
                ) : (
                  <Text weight={700} color={active ? 'white' : 'maroon'} style={styles.stepNumber}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text variant="small" weight={600} color={done || active ? 'ink' : 'muted'}>
                {label}
              </Text>
            </View>
            {i < STEPS.length - 1 ? <View style={[styles.connector, { backgroundColor: done ? colors.maroon : colors.divider }]} /> : null}
          </Fragment>
        );
      })}
    </View>
  );
}

/** Cart line (PDF screen 12). Server warnings (price, stock) show under the name in hot pink. */
export const CartItemCard = memo(function CartItemCard({
  line,
  branchName,
  onQty,
  onRemove,
}: {
  line: CartLine;
  branchName?: string | null;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const router = useRouter();
  const { product, qty, lineTotal } = line;
  const name = product?.name ?? 'This product';
  const warning = lineWarning(line) as string | null;
  const image = product?.image ?? product?.images?.[0] ?? null;
  const open = product ? () => router.push(ROUTES.product(product.id)) : undefined;
  return (
    <Card style={styles.line}>
      <View testID={`cart-line-${line.productId}`} style={styles.lineRow}>
        <Pressable onPress={open} disabled={!open} accessible={false} style={styles.thumb}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={line.productId} />
          ) : null}
        </Pressable>
        <View style={styles.flex}>
          <Pressable onPress={open} disabled={!open} accessibilityRole={open ? 'link' : undefined} style={styles.nameWrap}>
            <Text weight={700} style={styles.name}>
              {name}
            </Text>
          </Pressable>
          {product?.meta ? (
            <Text variant="label" weight={400} color="muted">
              {product.meta}
            </Text>
          ) : null}
          {branchName && line.available ? (
            <View style={styles.from}>
              <Store size={15} color={colors.maroon} strokeWidth={1.9} />
              <Text variant="label" color="maroon" numberOfLines={1} style={styles.flex}>
                From {branchName}
              </Text>
            </View>
          ) : null}
          {warning ? (
            <Text variant="label" color="hotpink" style={styles.warning} accessibilityLiveRegion="polite">
              {warning}
            </Text>
          ) : null}
          <View style={styles.lineBottom}>
            {line.available ? (
              <Stepper value={qty} onChange={onQty} onRemoveAtMin={onRemove} max={line.maxQuantity || 20} label={`Quantity of ${name}`} />
            ) : (
              <View />
            )}
            <Text weight={700} style={styles.lineTotal}>
              {formatSAR(lineTotal)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.remove}>
        <IconButton icon={Trash2} label={`Remove ${name}`} variant="plain" size="sm" iconSize={19} onPress={onRemove} />
      </View>
    </Card>
  );
});

/** Totals card: the items and their total (RSOF's product prices only). */
export function OrderSummary({
  totals,
  title,
  dimmed,
  style,
  children,
}: {
  totals: Totals;
  title?: string;
  dimmed?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <Card style={[styles.summary, dimmed && styles.dimmed, style]}>
      {title ? (
        <Text variant="h3" accessibilityRole="header" style={styles.summaryTitle}>
          {title}
        </Text>
      ) : null}
      <View style={styles.summaryRows}>
        <SummaryRow label={`Subtotal (${totals.count} ${totals.count === 1 ? 'item' : 'items'})`} value={formatSAR(totals.subtotal)} />
      </View>
      <View style={styles.divider} />
      <View style={styles.totalRow}>
        <Text weight={700} style={styles.totalLabel}>
          Total
        </Text>
        <Text weight={700} color="maroon" style={styles.total}>
          {formatSAR(totals.total)}
        </Text>
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 13, lineHeight: 16 },
  connector: { flex: 1, height: 1.5, borderRadius: radii.pill },
  line: { padding: 14 },
  lineRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 88, height: 88, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.sand },
  nameWrap: { paddingRight: 32 },
  name: { fontSize: 16, lineHeight: 21 },
  from: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  warning: { marginTop: 4 },
  lineBottom: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lineTotal: { fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  remove: { position: 'absolute', top: 8, right: 8 },
  summary: { padding: 16 },
  dimmed: { opacity: 0.6 },
  summaryTitle: { marginBottom: 12 },
  summaryRows: { gap: 12 },
  divider: { marginVertical: 14, height: 2, borderRadius: radii.pill, backgroundColor: colors.divider },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 },
  totalLabel: { fontSize: 16, lineHeight: 22 },
  total: { fontSize: 22, lineHeight: 28, fontVariant: ['tabular-nums'] },
});
