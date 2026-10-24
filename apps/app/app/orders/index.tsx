import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ordersApi, type Order } from '@reelbazaar/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { timeAgo } from '@/lib/timeAgo';
import { radius, spacing, typography } from '@/theme';

export default function OrdersListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { user, guestMode } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered'>('all');

  const loadOrders = useCallback(async () => {
    if (guestMode || !user) {
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await ordersApi.getBuyerOrders();
      setOrders(res.orders || []);
    } catch (err) {
      console.warn('Orders fetch fallback to empty list:', err);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guestMode, user]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((o) => {
    if (filter === 'active') {
      return !['delivered', 'cancelled', 'failed'].includes(o.status);
    }
    if (filter === 'delivered') {
      return o.status === 'delivered';
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return { label: 'Delivered', bg: palette.successSoft, text: palette.success, icon: 'checkmark-circle' };
      case 'shipped':
        return { label: 'Shipped', bg: palette.accentSoft, text: palette.accent, icon: 'airplane' };
      case 'out_for_delivery':
        return { label: 'Out for Delivery', bg: palette.accentSoft, text: palette.accent, icon: 'bicycle' };
      case 'packed':
        return { label: 'Packed', bg: palette.warningSoft, text: palette.warning, icon: 'cube' };
      case 'confirmed':
        return { label: 'Confirmed', bg: palette.successSoft, text: palette.success, icon: 'checkmark' };
      case 'cancelled':
        return { label: 'Cancelled', bg: palette.dangerSoft, text: palette.danger, icon: 'close-circle' };
      default:
        return { label: 'Processing', bg: palette.cardElevated, text: palette.textSecondary, icon: 'time' };
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>My Orders</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filtersRow, { borderBottomColor: palette.border }]}>
        {(['all', 'active', 'delivered'] as const).map((tab) => {
          const active = filter === tab;
          const label = tab === 'all' ? 'All Orders' : tab === 'active' ? 'Active' : 'Delivered';
          return (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={[
                styles.filterTab,
                active && [styles.filterTabActive, { borderBottomColor: palette.accent }],
              ]}
            >
              <Text
                style={[
                  styles.filterTabText,
                  {
                    color: active ? palette.accent : palette.textMuted,
                    fontWeight: active ? '700' : '500',
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Orders List */}
      {loading ? (
        <View style={styles.loadingArea}>
          <LoadingSpinner size="lg" label="Loading orders..." />
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing.xl }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadOrders();
              }}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: palette.accentSoft }]}>
                <Ionicons name="bag-handle-outline" size={44} color={palette.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>No orders yet</Text>
              <Text style={[styles.emptySub, { color: palette.textMuted }]}>
                Discover the latest creator reels and shop trending styles.
              </Text>
              <Button
                label="Explore Feed & Shop"
                variant="primary"
                onPress={() => router.push('/')}
                style={styles.exploreBtn}
              />
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            return (
              <Pressable
                onPress={() => router.push(`/orders/${item.id}`)}
                style={({ pressed }) => [
                  styles.orderCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                {/* Order Top Line */}
                <View style={styles.orderTopLine}>
                  <View>
                    <Text style={[styles.orderIdText, { color: palette.textMuted }]}>
                      Order #{item.id.slice(0, 8).toUpperCase()}
                    </Text>
                    <Text style={[styles.orderDateText, { color: palette.textMuted }]}>
                      {timeAgo(item.createdAt)}
                    </Text>
                  </View>

                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Ionicons name={badge.icon as any} size={12} color={badge.text} />
                    <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                {/* Product Detail Row */}
                <View style={styles.productRow}>
                  <View style={styles.productThumb}>
                    {item.productImageUrl ? (
                      <Image
                        source={{ uri: item.productImageUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.thumbFallback]}>
                        <Ionicons name="bag" size={20} color={palette.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.productInfo}>
                    {item.brandName ? (
                      <Text style={[styles.brandNameText, { color: palette.textSecondary }]}>
                        {item.brandName}
                      </Text>
                    ) : null}
                    <Text style={[styles.productNameText, { color: palette.text }]} numberOfLines={2}>
                      {item.productName}
                    </Text>
                    <Text style={[styles.itemQty, { color: palette.textMuted }]}>
                      Qty: {item.quantity || 1}
                    </Text>
                  </View>
                </View>

                {/* Card Footer */}
                <View style={[styles.cardFooter, { borderTopColor: palette.border }]}>
                  <View>
                    <Text style={[styles.amountLabel, { color: palette.textMuted }]}>Total Paid</Text>
                    <Text style={[styles.amountValue, { color: palette.text }]}>
                      ₹{item.amount?.toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.trackAction}>
                    <Text style={[styles.trackActionText, { color: palette.accent }]}>
                      Track Package
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.accent} />
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
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
  filtersRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {},
  filterTabText: { fontSize: 13 },
  loadingArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.lg, gap: spacing.md },
  orderCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  orderTopLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderIdText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  orderDateText: { fontSize: 11, marginTop: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  productRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  productThumb: {
    width: 60,
    height: 60,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#1a1a22',
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productInfo: { flex: 1, gap: 2 },
  brandNameText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  productNameText: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  itemQty: { fontSize: 12 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  amountLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue: { fontSize: 15, fontWeight: '800' },
  trackAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  trackActionText: { fontSize: 13, fontWeight: '700' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...typography.heading, fontSize: 18, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  exploreBtn: { marginTop: spacing.sm, minWidth: 200 },
});
