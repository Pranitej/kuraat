import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronRight, Store, X } from '@/components/icons';
import { Card, Tag, Text, type TagTone } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import { formatOrderDate, formatSAR, orderItemCount, orderStatusView } from '@/domain';
import { colors, radii } from '@/theme/theme';
import type { Order } from '@/types/api';

export type StatusView = { id: string; label: string; step: number; cancelled: boolean; ongoing: boolean; tone: TagTone };
export type TimelineRow = { id: string; title: string; state: 'done' | 'current' | 'todo' | 'cancelled'; time: string };

/** Status tag: dark while on its way, light with a check when delivered, alert when cancelled. */
export function StatusTag({ status }: { status: StatusView }) {
  const icon = status.cancelled ? X : status.id === 'delivered' ? Check : undefined;
  return (
    <Tag tone={status.tone} icon={icon} style={styles.statusTag}>
      {status.label}
    </Tag>
  );
}

/** "Will be delivered from" / "Delivered from" / "Ordered from" (cancelled). */
export function branchLabel(status: StatusView): string {
  if (status.cancelled) return 'Ordered from';
  return status.ongoing ? 'Will be delivered from' : 'Delivered from';
}

/** Up to three thumbnails, one per unit ordered (PDF screen 20). */
function Thumbnails({ items }: { items: Order['items'] }) {
  const units = items.flatMap((i) => Array.from({ length: i.qty }, () => i)).slice(0, 3);
  return (
    <View style={styles.thumbs}>
      {units.map((item, idx) => (
        <View key={`${item.productId}-${idx}`} style={styles.thumb}>
          {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
      ))}
    </View>
  );
}

/** Order card (PDF screen 20). */
export const OrderCard = memo(function OrderCard({ order, now }: { order: Order; now: Date }) {
  const router = useRouter();
  const status = orderStatusView(order) as StatusView;
  const count = orderItemCount(order) as number;
  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => router.push(ROUTES.order(order.id))}
        accessibilityRole="button"
        accessibilityLabel={`Order ${order.number}, ${status.label}, ${formatSAR(order.total)}`}
      >
        <View style={styles.cardTop}>
          <View>
            <Text weight={700} style={styles.number}>
              #{order.number}
            </Text>
            <Text variant="label" weight={400} color="muted">
              {formatOrderDate(order.createdAt, now)}
            </Text>
          </View>
          <StatusTag status={status} />
        </View>
        <View style={styles.cardMiddle}>
          <Thumbnails items={order.items} />
          <View style={styles.right}>
            <Text variant="small" color="muted">
              {count} {count === 1 ? 'item' : 'items'}
            </Text>
            <Text weight={700} style={styles.total}>
              {formatSAR(order.total)}
            </Text>
          </View>
        </View>
      </Pressable>
      {order.branch ? (
        <Pressable
          onPress={() => router.push(ROUTES.branch(order.branch!.id))}
          accessibilityRole="button"
          accessibilityLabel={`${branchLabel(status)} ${order.branch.name}`}
          style={({ pressed }) => [styles.branch, pressed && styles.branchPressed]}
        >
          <Store size={20} color={colors.maroon} strokeWidth={1.8} />
          <View style={styles.flex}>
            <Text variant="label" weight={400} color="muted">
              {branchLabel(status)}
            </Text>
            <Text weight={700} numberOfLines={1} style={styles.branchName}>
              {order.branch.name}
            </Text>
          </View>
          <ChevronRight size={20} color={colors.ink} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </Card>
  );
});

/** Tracking timeline (PDF screen 22); rows from orderTimelineView(). */
export function OrderTimeline({ steps }: { steps: TimelineRow[] }) {
  return (
    <View>
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const next = steps[i + 1];
        const reached = step.state !== 'todo';
        const lineColor = next
          ? next.state === 'cancelled'
            ? 'rgba(237,59,92,0.4)'
            : next.state !== 'todo'
              ? colors.maroon
              : colors.divider
          : 'transparent';
        const spoken =
          step.state === 'done' ? 'completed' : step.state === 'current' ? 'in progress' : step.state === 'cancelled' ? '' : 'upcoming';
        return (
          <View
            key={step.id}
            style={[styles.stepRow, !last && styles.stepGap]}
            accessible
            accessibilityLabel={`${step.title}${spoken ? `, ${spoken}` : ''}. ${step.time}`}
          >
            {!last ? <View style={[styles.stepLine, { backgroundColor: lineColor }]} /> : null}
            <View
              style={[
                styles.node,
                step.state === 'done' && styles.nodeDone,
                step.state === 'current' && styles.nodeCurrent,
                step.state === 'todo' && styles.nodeTodo,
                step.state === 'cancelled' && styles.nodeCancelled,
              ]}
            >
              {step.state === 'done' ? <Check size={13} color={colors.white} strokeWidth={3} /> : null}
              {step.state === 'current' ? <View style={styles.nodeDot} /> : null}
              {step.state === 'cancelled' ? <X size={13} color={colors.white} strokeWidth={3} /> : null}
            </View>
            <View style={styles.flex}>
              <Text weight={700} color={step.state === 'cancelled' ? 'hotpink' : reached ? 'ink' : 'muted'} style={styles.stepTitle}>
                {step.title}
              </Text>
              <Text variant="label" weight={400} color="muted">
                {step.time}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  statusTag: { height: 28, paddingHorizontal: 12 },
  card: { padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  number: { fontSize: 17, lineHeight: 24 },
  cardMiddle: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  thumbs: { flexDirection: 'row', gap: 8 },
  thumb: { width: 48, height: 48, borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.sand },
  right: { alignItems: 'flex-end' },
  total: { fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
  branch: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.sand,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  branchPressed: { backgroundColor: '#EFD5C7' },
  branchName: { fontSize: 15 },
  stepRow: { flexDirection: 'row', gap: 16 },
  stepGap: { paddingBottom: 20 },
  stepLine: { position: 'absolute', left: 10, top: 24, bottom: -4, width: 2, borderRadius: radii.pill },
  node: { marginTop: 2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  nodeDone: { backgroundColor: colors.maroon },
  nodeCurrent: { borderWidth: 2, borderColor: colors.maroon, backgroundColor: colors.white },
  nodeTodo: { borderWidth: 2, borderColor: colors.line, backgroundColor: colors.white },
  nodeCancelled: { backgroundColor: colors.hotpink },
  nodeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.maroon },
  stepTitle: { fontSize: 16, lineHeight: 22 },
});
