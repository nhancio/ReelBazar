import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ordersApi, type Order, type ShippingAddress } from '@reelbazaar/api';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { timeAgo } from '@/lib/timeAgo';
import { radius, spacing, typography } from '@/theme';

export default function OrderDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { palette, theme } = useTheme();
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isDark = theme !== 'light';

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await ordersApi.getOrderById(orderId);
      setOrder(res.order);
    } catch (err: unknown) {
      console.error('Failed to load order:', err);
      showToast('Could not load order details', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId, showToast]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const trackingSteps = order?.tracking?.steps || [];

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Order Details</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.loadingArea}>
          <LoadingSpinner size="lg" label="Loading order tracking..." />
        </View>
      ) : !order ? (
        <View style={styles.emptyArea}>
          <Ionicons name="alert-circle-outline" size={48} color={palette.danger} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Order not found</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadOrder();
              }}
              tintColor={palette.accent}
            />
          }
        >
          {/* Order Status Banner */}
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor:
                  order.status === 'delivered'
                    ? 'rgba(34,197,94,0.15)'
                    : order.status === 'cancelled' || order.status === 'failed'
                      ? 'rgba(239,68,68,0.15)'
                      : palette.accentSoft,
                borderColor:
                  order.status === 'delivered'
                    ? '#22c55e'
                    : order.status === 'cancelled'
                      ? '#ef4444'
                      : palette.accent,
              },
            ]}
          >
            <View style={styles.statusBannerLeft}>
              <Text
                style={[
                  styles.statusHeadline,
                  {
                    color:
                      order.status === 'delivered'
                        ? '#22c55e'
                        : order.status === 'cancelled'
                          ? '#ef4444'
                          : palette.accent,
                  },
                ]}
              >
                {order.status === 'delivered'
                  ? 'Delivered Successfully'
                  : order.status === 'shipped'
                    ? 'Package is on the way'
                    : order.status === 'packed'
                      ? 'Packed & Ready to Ship'
                      : order.status === 'confirmed'
                        ? 'Order Confirmed'
                        : order.status.toUpperCase()}
              </Text>
              <Text style={[styles.statusOrderNum, { color: palette.textSecondary }]}>
                Order #{order.id.slice(0, 10).toUpperCase()} · Placed {timeAgo(order.createdAt)}
              </Text>
            </View>

            <Ionicons
              name={
                order.status === 'delivered'
                  ? 'checkmark-circle'
                  : order.status === 'shipped'
                    ? 'airplane'
                    : order.status === 'packed'
                      ? 'cube'
                      : 'bag-check'
              }
              size={28}
              color={
                order.status === 'delivered'
                  ? '#22c55e'
                  : order.status === 'cancelled'
                    ? '#ef4444'
                    : palette.accent
              }
            />
          </View>

          {/* Live Tracking Timeline */}
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="git-commit-outline" size={18} color={palette.accent} />
              <Text style={[styles.cardTitle, { color: palette.text }]}>Live Tracking Progress</Text>
            </View>

            <View style={styles.timelineContainer}>
              {trackingSteps.map((step, idx) => {
                const isLast = idx === trackingSteps.length - 1;
                return (
                  <View key={step.status} style={styles.timelineStep}>
                    <View style={styles.timelineLeftCol}>
                      <View
                        style={[
                          styles.timelineNode,
                          {
                            backgroundColor: step.done ? '#22c55e' : isDark ? '#2a303c' : '#e2e8f0',
                            borderColor: step.done ? '#22c55e' : palette.border,
                          },
                        ]}
                      >
                        {step.done ? (
                          <Ionicons name="checkmark" size={12} color="#ffffff" />
                        ) : (
                          <View style={styles.timelineNodePending} />
                        )}
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.timelineLine,
                            {
                              backgroundColor: step.done ? '#22c55e' : isDark ? '#2a303c' : '#e2e8f0',
                            },
                          ]}
                        />
                      )}
                    </View>

                    <View style={styles.timelineContent}>
                      <Text
                        style={[
                          styles.stepLabel,
                          {
                            color: step.done ? palette.text : palette.textMuted,
                            fontWeight: step.done ? '700' : '500',
                          },
                        ]}
                      >
                        {step.label}
                      </Text>
                      {step.done && step.at && (
                        <Text style={[styles.stepTimestamp, { color: palette.textMuted }]}>
                          {new Date(step.at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Courier Info if Shipped */}
            {order.courierName || order.trackingNumber ? (
              <View
                style={[
                  styles.courierInfoBox,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={styles.courierRow}>
                  <Ionicons name="navigate" size={16} color={palette.accent} />
                  <Text style={[styles.courierLabel, { color: palette.textMuted }]}>Courier:</Text>
                  <Text style={[styles.courierVal, { color: palette.text }]}>{order.courierName || 'BlueDart Express'}</Text>
                </View>
                {order.trackingNumber && (
                  <View style={styles.courierRow}>
                    <Ionicons name="barcode-outline" size={16} color={palette.accent} />
                    <Text style={[styles.courierLabel, { color: palette.textMuted }]}>Tracking AWB:</Text>
                    <Text style={[styles.courierVal, { color: palette.text, fontWeight: '700' }]}>{order.trackingNumber}</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>

          {/* Product Ordered */}
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Item Summary</Text>

            <View style={styles.productRow}>
              <View style={styles.productThumb}>
                {order.productImageUrl ? (
                  <Image source={{ uri: order.productImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.thumbFallback]}>
                    <Ionicons name="bag" size={24} color={palette.textMuted} />
                  </View>
                )}
              </View>

              <View style={styles.productInfo}>
                {order.brandName && (
                  <Text style={[styles.brandText, { color: palette.textSecondary }]}>
                    {order.brandName}
                  </Text>
                )}
                <Text style={[styles.productName, { color: palette.text }]} numberOfLines={2}>
                  {order.productName}
                </Text>
                <Text style={[styles.qtyText, { color: palette.textMuted }]}>
                  Quantity: {order.quantity || 1}
                </Text>
                <Text style={[styles.priceText, { color: palette.text }]}>
                  ₹{order.amount?.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* Shipping Address */}
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="location-outline" size={18} color={palette.accent} />
              <Text style={[styles.cardTitle, { color: palette.text }]}>Delivery Address</Text>
            </View>

            <View style={styles.addressInfo}>
              <Text style={[styles.buyerName, { color: palette.text }]}>
                {order.buyerName || 'Customer'}
              </Text>
              {order.buyerPhone && (
                <Text style={[styles.addressLine, { color: palette.textSecondary }]}>
                  📞 {order.buyerPhone}
                </Text>
              )}
              {order.shippingAddress ? (
                typeof order.shippingAddress === 'string' ? (
                  <Text style={[styles.addressLine, { color: palette.textSecondary }]}>
                    {order.shippingAddress}
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.addressLine, { color: palette.textSecondary }]}>
                      {(order.shippingAddress as ShippingAddress).street}
                    </Text>
                    <Text style={[styles.addressLine, { color: palette.textSecondary }]}>
                      {(order.shippingAddress as ShippingAddress).city}, {(order.shippingAddress as ShippingAddress).state} - {(order.shippingAddress as ShippingAddress).pincode}
                    </Text>
                  </>
                )
              ) : (
                <Text style={[styles.addressLine, { color: palette.textMuted }]}>Standard doorstep delivery</Text>
              )}
            </View>
          </View>

          {/* Payment & Price Summary */}
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="receipt-outline" size={18} color={palette.accent} />
              <Text style={[styles.cardTitle, { color: palette.text }]}>Payment & Price Details</Text>
            </View>

            <View style={styles.billRows}>
              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: palette.textMuted }]}>Payment Method</Text>
                <Text style={[styles.billVal, { color: palette.text }]}>
                  {order.paymentProvider === 'razorpay' ? 'Razorpay (UPI / Cards / Netbanking)' : 'Demo Sandbox'}
                </Text>
              </View>

              {order.razorpayPaymentId && (
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { color: palette.textMuted }]}>Payment ID</Text>
                  <Text style={[styles.billVal, { color: palette.text }]}>{order.razorpayPaymentId}</Text>
                </View>
              )}

              <View style={styles.billRow}>
                <Text style={[styles.billLabel, { color: palette.textMuted }]}>Shipping</Text>
                <Text style={[styles.billVal, { color: '#22c55e', fontWeight: '700' }]}>FREE</Text>
              </View>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.billRow}>
                <Text style={[styles.totalBillLabel, { color: palette.text }]}>Total Amount Paid</Text>
                <Text style={[styles.totalBillVal, { color: palette.text }]}>
                  ₹{order.amount?.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.heading, fontSize: 18, fontWeight: '700' },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: spacing.lg, gap: spacing.md },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  statusBannerLeft: { flex: 1, gap: 2 },
  statusHeadline: { fontSize: 16, fontWeight: '800' },
  statusOrderNum: { fontSize: 12 },
  card: {
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  timelineContainer: { paddingLeft: 6, paddingTop: spacing.xs },
  timelineStep: { flexDirection: 'row', gap: spacing.md, minHeight: 44 },
  timelineLeftCol: { alignItems: 'center', width: 20 },
  timelineNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineNodePending: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineContent: { flex: 1, paddingBottom: spacing.md, gap: 2 },
  stepLabel: { fontSize: 13 },
  stepTimestamp: { fontSize: 11 },
  courierInfoBox: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs },
  courierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  courierLabel: { fontSize: 12 },
  courierVal: { fontSize: 12, fontWeight: '600' },
  productRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  productThumb: { width: 70, height: 70, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#1a1a22' },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, gap: 2 },
  brandText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  productName: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  qtyText: { fontSize: 12 },
  priceText: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  addressInfo: { gap: 4 },
  buyerName: { fontSize: 14, fontWeight: '700' },
  addressLine: { fontSize: 13, lineHeight: 18 },
  billRows: { gap: 8 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billLabel: { fontSize: 13 },
  billVal: { fontSize: 13, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  totalBillLabel: { fontSize: 15, fontWeight: '800' },
  totalBillVal: { fontSize: 17, fontWeight: '800' },
});
