import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ordersApi, type CheckoutResponse, type Order } from '@reelbazaar/api';
import type { BrandProduct, Reel } from '@reelbazaar/config';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { RazorpayCheckoutModal } from '@/components/RazorpayCheckoutModal';
import { radius, spacing, typography } from '@/theme';

interface Props {
  visible: boolean;
  product: BrandProduct | null;
  reel?: Reel | null;
  onClose: () => void;
}

export function ProductPurchaseDrawer({
  visible,
  product,
  reel,
  onClose,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, theme } = useTheme();
  const { user, guestMode } = useAuth();
  const { showToast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [buyerName, setBuyerName] = useState(user?.name || '');
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || '');

  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const isDark = theme !== 'light';

  const resetForm = useCallback(() => {
    setQuantity(1);
    setCheckingOut(false);
    setCheckoutData(null);
    setShowRazorpayModal(false);
    setConfirmedOrder(null);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!product) return null;

  const price = product.price || 0;
  const originalPrice = product.originalPrice || Math.round(price * 1.3);
  const discountPercent = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const totalPrice = price * quantity;

  const handleBuyNow = async () => {
    if (guestMode || !user) {
      showToast('Please sign in to place an order', 'info');
      onClose();
      router.push('/auth');
      return;
    }

    if (!street.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
      showToast('Please fill in complete delivery address', 'info');
      return;
    }

    if (!/^\d{6}$/.test(pincode.trim())) {
      showToast('Please enter a valid 6-digit pincode', 'info');
      return;
    }

    setCheckingOut(true);
    try {
      const shippingAddress = {
        street: street.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        country: 'India',
      };

      const res = await ordersApi.checkout({
        productId: product.id,
        reelId: reel?.id,
        creatorId: reel?.creatorId,
        quantity,
        shippingAddress,
        buyerName: buyerName.trim() || user.name,
        buyerPhone: buyerPhone.trim() || undefined,
      });

      setCheckoutData(res);
      setShowRazorpayModal(true);
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      const msg = err instanceof Error ? err.message : 'Could not initialize checkout';
      showToast(msg, 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleOrderSuccess = (order: Order) => {
    setShowRazorpayModal(false);
    setConfirmedOrder(order);
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <Pressable style={styles.scrim} onPress={handleClose} />
          
          <View
            style={[
              styles.drawer,
              {
                backgroundColor: palette.card,
                paddingBottom: insets.bottom + spacing.md,
                borderTopColor: palette.border,
              },
            ]}
          >
            {/* Drawer handle */}
            <View style={styles.handleWrap}>
              <View style={[styles.handleBar, { backgroundColor: palette.border }]} />
            </View>

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: palette.border }]}>
              <View style={styles.headerTitleRow}>
                <Ionicons name="bag-handle" size={20} color={palette.accent} />
                <Text style={[styles.headerTitle, { color: palette.text }]}>
                  {confirmedOrder ? 'Order Confirmed' : 'Instant Checkout'}
                </Text>
              </View>
              <Pressable onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={palette.textMuted} />
              </Pressable>
            </View>

            {confirmedOrder ? (
              /* Success View */
              <View style={styles.successContainer}>
                <View style={[styles.successIconWrap, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                  <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
                </View>

                <Text style={[styles.successTitle, { color: palette.text }]}>
                  Thank you for your order!
                </Text>
                <Text style={[styles.successSub, { color: palette.textMuted }]}>
                  Order #{confirmedOrder.id.slice(0, 10).toUpperCase()} has been confirmed.
                </Text>

                <View style={[styles.successCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: palette.border }]}>
                  <View style={styles.successItemRow}>
                    <Text style={[styles.successLabel, { color: palette.textMuted }]}>Item</Text>
                    <Text style={[styles.successVal, { color: palette.text }]} numberOfLines={1}>{confirmedOrder.productName}</Text>
                  </View>
                  <View style={styles.successItemRow}>
                    <Text style={[styles.successLabel, { color: palette.textMuted }]}>Amount Paid</Text>
                    <Text style={[styles.successVal, { color: '#22c55e', fontWeight: '800' }]}>₹{confirmedOrder.amount.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.successItemRow}>
                    <Text style={[styles.successLabel, { color: palette.textMuted }]}>Estimated Delivery</Text>
                    <Text style={[styles.successVal, { color: palette.text }]}>2-4 Business Days</Text>
                  </View>
                </View>

                <View style={styles.successActions}>
                  <Button
                    label="Track Live Order"
                    variant="primary"
                    onPress={() => {
                      handleClose();
                      router.push(`/orders/${confirmedOrder.id}`);
                    }}
                    fullWidth
                  />
                  <Button
                    label="Continue Watching"
                    variant="secondary"
                    onPress={handleClose}
                    fullWidth
                  />
                </View>
              </View>
            ) : (
              /* Checkout Form View */
              <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Product Summary Banner */}
                <View style={[styles.productBanner, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: palette.border }]}>
                  <View style={styles.productImageWrap}>
                    {product.imageUrl ? (
                      <Image
                        source={{ uri: product.imageUrl }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]}>
                        <Ionicons name="shirt-outline" size={28} color={palette.textMuted} />
                      </View>
                    )}
                  </View>

                  <View style={styles.productDetails}>
                    <View style={styles.brandRow}>
                      <Avatar uri={product.brandAvatarUrl} name={product.brandName} size={18} />
                      <Text style={[styles.brandNameText, { color: palette.textSecondary }]} numberOfLines={1}>
                        {product.brandName || 'Verified Brand'}
                      </Text>
                      <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
                    </View>

                    <Text style={[styles.productTitle, { color: palette.text }]} numberOfLines={2}>
                      {product.name}
                    </Text>

                    <View style={styles.priceRow}>
                      <Text style={[styles.currentPrice, { color: palette.text }]}>
                        ₹{price.toLocaleString('en-IN')}
                      </Text>
                      {originalPrice > price && (
                        <Text style={[styles.originalPrice, { color: palette.textMuted }]}>
                          ₹{originalPrice.toLocaleString('en-IN')}
                        </Text>
                      )}
                      {discountPercent > 0 && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>{discountPercent}% OFF</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Creator tag badge */}
                {reel?.creator ? (
                  <View style={[styles.creatorBadge, { backgroundColor: palette.accentSoft }]}>
                    <Avatar uri={reel.creator.avatarUrl} name={reel.creator.name} size={20} />
                    <Text style={[styles.creatorBadgeText, { color: palette.accent }]} numberOfLines={1}>
                      Tagged by @{reel.creator.username || reel.creator.name} · Creator Pick
                    </Text>
                  </View>
                ) : null}

                {/* Quantity Selector */}
                <View style={[styles.sectionRow, { borderBottomColor: palette.border }]}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>Quantity</Text>
                  <View style={styles.qtyControl}>
                    <Pressable
                      onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                      style={[styles.qtyBtn, { borderColor: palette.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                      hitSlop={6}
                    >
                      <Ionicons name="remove" size={16} color={palette.text} />
                    </Pressable>
                    <Text style={[styles.qtyValue, { color: palette.text }]}>{quantity}</Text>
                    <Pressable
                      onPress={() => setQuantity((q) => Math.min(10, q + 1))}
                      style={[styles.qtyBtn, { borderColor: palette.border, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                      hitSlop={6}
                    >
                      <Ionicons name="add" size={16} color={palette.text} />
                    </Pressable>
                  </View>
                </View>

                {/* Shipping Address */}
                <View style={styles.addressSection}>
                  <Text style={[styles.sectionTitle, { color: palette.text }]}>Shipping Address</Text>
                  
                  <View style={styles.formGrid}>
                    <TextInput
                      value={buyerName}
                      onChangeText={setBuyerName}
                      placeholder="Full Name"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                      style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: palette.borderInteractive, color: palette.text }]}
                    />

                    <TextInput
                      value={buyerPhone}
                      onChangeText={setBuyerPhone}
                      placeholder="Mobile Phone (for delivery SMS)"
                      keyboardType="phone-pad"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                      style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: palette.borderInteractive, color: palette.text }]}
                    />

                    <TextInput
                      value={street}
                      onChangeText={setStreet}
                      placeholder="House / Flat / Street Address"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                      style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: palette.borderInteractive, color: palette.text }]}
                    />

                    <View style={styles.inputRow}>
                      <TextInput
                        value={city}
                        onChangeText={setCity}
                        placeholder="City"
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                        style={[styles.input, { flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: palette.borderInteractive, color: palette.text }]}
                      />
                      <TextInput
                        value={pincode}
                        onChangeText={setPincode}
                        placeholder="Pincode"
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                        style={[styles.input, { width: 120, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: palette.borderInteractive, color: palette.text }]}
                      />
                    </View>

                    <TextInput
                      value={stateName}
                      onChangeText={setStateName}
                      placeholder="State (e.g. Maharashtra, Karnataka)"
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                      style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: palette.borderInteractive, color: palette.text }]}
                    />
                  </View>
                </View>

                {/* Price Breakdown */}
                <View style={[styles.breakdownCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderColor: palette.border }]}>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: palette.textMuted }]}>Item Total ({quantity} {quantity === 1 ? 'item' : 'items'})</Text>
                    <Text style={[styles.breakdownVal, { color: palette.text }]}>₹{totalPrice.toLocaleString('en-IN')}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: palette.textMuted }]}>Delivery Charges</Text>
                    <Text style={[styles.breakdownVal, { color: '#22c55e', fontWeight: '700' }]}>FREE</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownLabel, { color: palette.textMuted }]}>Platform Fee</Text>
                    <Text style={[styles.breakdownVal, { color: '#22c55e', fontWeight: '700' }]}>FREE</Text>
                  </View>
                  <View style={[styles.breakdownDivider, { backgroundColor: palette.border }]} />
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.totalLabel, { color: palette.text }]}>Total Amount</Text>
                    <Text style={[styles.totalVal, { color: palette.text }]}>₹{totalPrice.toLocaleString('en-IN')}</Text>
                  </View>
                </View>

                {/* Submit Checkout Button */}
                <Button
                  label={checkingOut ? 'Initializing Secure Payment…' : `Pay ₹${totalPrice.toLocaleString('en-IN')} with Razorpay`}
                  variant="primary"
                  loading={checkingOut}
                  onPress={handleBuyNow}
                  fullWidth
                  style={styles.payBtn}
                />

                <View style={styles.trustBadges}>
                  <View style={styles.trustItem}>
                    <Ionicons name="shield-checkmark-outline" size={14} color={palette.textMuted} />
                    <Text style={[styles.trustText, { color: palette.textMuted }]}>100% Genuine</Text>
                  </View>
                  <View style={styles.trustItem}>
                    <Ionicons name="sync-outline" size={14} color={palette.textMuted} />
                    <Text style={[styles.trustText, { color: palette.textMuted }]}>7-Day Returns</Text>
                  </View>
                  <View style={styles.trustItem}>
                    <Ionicons name="lock-closed-outline" size={14} color={palette.textMuted} />
                    <Text style={[styles.trustText, { color: palette.textMuted }]}>Razorpay Secured</Text>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Razorpay In-App Payment Handler Modal */}
      <RazorpayCheckoutModal
        visible={showRazorpayModal}
        checkoutData={checkoutData}
        onSuccess={handleOrderSuccess}
        onClose={() => setShowRazorpayModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  drawer: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '90%',
    minHeight: 460,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handleBar: { width: 38, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { ...typography.heading, fontSize: 17, fontWeight: '700' },
  closeBtn: { padding: 4 },
  scrollArea: { flexShrink: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.md },
  productBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  productImageWrap: {
    width: 76,
    height: 76,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#20242c',
  },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productDetails: { flex: 1, justifyContent: 'center', gap: 3 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  brandNameText: { fontSize: 12, fontWeight: '600' },
  productTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  currentPrice: { fontSize: 17, fontWeight: '800' },
  originalPrice: { fontSize: 13, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: '#22c55e', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  creatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  creatorBadgeText: { fontSize: 12, fontWeight: '600', flex: 1 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: { fontSize: 16, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  addressSection: { gap: spacing.sm },
  formGrid: { gap: spacing.sm },
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  breakdownCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { fontSize: 13 },
  breakdownVal: { fontSize: 13, fontWeight: '600' },
  breakdownDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  totalLabel: { fontSize: 15, fontWeight: '800' },
  totalVal: { fontSize: 18, fontWeight: '800' },
  payBtn: { minHeight: 52, marginTop: spacing.xs },
  trustBadges: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: spacing.xs },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText: { fontSize: 11 },
  successContainer: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  successIconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  successTitle: { ...typography.heading, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successSub: { fontSize: 13, textAlign: 'center' },
  successCard: { width: '100%', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: 8 },
  successItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successLabel: { fontSize: 13 },
  successVal: { fontSize: 13, fontWeight: '600', maxWidth: '60%' },
  successActions: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
});
