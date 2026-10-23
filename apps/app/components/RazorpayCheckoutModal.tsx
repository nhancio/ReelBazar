import { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { ordersApi, type CheckoutResponse, type Order } from '@reelbazaar/api';
import { openRazorpayCheckout } from './razorpayCheckout';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { radius, spacing, typography } from '@/theme';

interface Props {
  visible: boolean;
  checkoutData: CheckoutResponse | null;
  onSuccess: (order: Order) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function RazorpayCheckoutModal({
  visible,
  checkoutData,
  onSuccess,
  onClose,
}: Props) {
  const { palette, theme } = useTheme();
  const { showToast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const isDark = theme !== 'light';

  const handleVerify = useCallback(
    async (rzpOrderId: string, paymentId: string, signature: string) => {
      if (!checkoutData) return;
      setVerifying(true);
      try {
        const res = await ordersApi.verifyPayment({
          orderId: checkoutData.order.id,
          razorpayOrderId: rzpOrderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        });

        if (res.success) {
          if (Platform.OS !== 'web') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
          showToast('Payment verified successfully! 🎉', 'success');
          onSuccess(res.order);
        } else {
          showToast('Payment verification failed', 'error');
        }
      } catch (err: unknown) {
        console.error('Payment verification error:', err);
        const msg = err instanceof Error ? err.message : 'Verification failed';
        showToast(msg, 'error');
      } finally {
        setVerifying(false);
      }
    },
    [checkoutData, onSuccess, showToast]
  );

  const triggerRazorpayCheckout = useCallback(async () => {
    if (!checkoutData || !checkoutData.razorpayOrderId) return;
    if (!checkoutData.keyId) {
      showToast('Razorpay is not configured for this checkout', 'error');
      return;
    }

    setProcessing(true);
    try {
      const response = await openRazorpayCheckout({
          key: checkoutData.keyId,
          amount: Math.round(checkoutData.amount * 100),
          currency: checkoutData.currency || 'INR',
          name: 'Rava Marketplace',
          description: checkoutData.order.productName || 'Product Order',
          order_id: checkoutData.razorpayOrderId,
          prefill: {
            name: checkoutData.order.buyerName || '',
            email: checkoutData.order.buyerEmail || '',
            contact: checkoutData.order.buyerPhone || '',
          },
          theme: {
            color: '#ff3366',
          },
          modal: { ondismiss: () => setProcessing(false) },
      });
      if (!response.razorpay_order_id || !response.razorpay_payment_id || !response.razorpay_signature) {
        throw new Error('Payment response was incomplete; your order was not confirmed');
      }
      await handleVerify(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
    } catch (err: unknown) {
      console.error('Failed to open Razorpay checkout:', err);
      const msg = err instanceof Error ? err.message : 'Failed to launch checkout';
      showToast(msg, 'error');
    } finally {
      setProcessing(false);
    }
  }, [checkoutData, handleVerify, showToast]);

  const handleSimulateDemoPayment = async () => {
    if (!checkoutData) return;
    setProcessing(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      showToast('Order confirmed (Demo Mode) 🎉', 'success');
      onSuccess(checkoutData.order);
    } catch (err) {
      console.error('Demo payment error:', err);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (visible && checkoutData) {
      if (checkoutData.demoMode) {
        // In demo mode, order is already confirmed on backend
      } else if (Platform.OS === 'web' && checkoutData.razorpayOrderId) {
        void triggerRazorpayCheckout();
      }
    }
  }, [visible, checkoutData, triggerRazorpayCheckout]);

  if (!visible || !checkoutData) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={!processing && !verifying ? onClose : undefined}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
              <Ionicons name="shield-checkmark" size={16} color={palette.accent} />
              <Text style={[styles.badgeText, { color: palette.accent }]}>
                {checkoutData.demoMode ? 'Demo Checkout' : 'Razorpay Secure'}
              </Text>
            </View>
            {!processing && !verifying && (
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={palette.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={[styles.title, { color: palette.text }]}>
              {checkoutData.order.productName}
            </Text>
            <Text style={[styles.amount, { color: palette.text }]}>
              ₹{checkoutData.amount.toLocaleString('en-IN')}
            </Text>

            {checkoutData.demoMode ? (
              <View
                style={[
                  styles.demoNotice,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                    borderColor: palette.border,
                  },
                ]}
              >
                <Ionicons name="information-circle" size={20} color={palette.accent} />
                <Text style={[styles.demoText, { color: palette.textSecondary }]}>
                  Razorpay keys are in demo sandbox mode. You can instantly confirm this order to test the live tracking timeline and creator earnings ledger.
                </Text>
              </View>
            ) : (
              <View style={styles.infoBox}>
                <Text style={[styles.infoText, { color: palette.textMuted }]}>
                  Order #{checkoutData.order.id.slice(0, 10)} · 256-bit SSL Encrypted
                </Text>
              </View>
            )}

            {verifying || processing ? (
              <View style={styles.loadingContainer}>
                <LoadingSpinner size="lg" />
                <Text style={[styles.loadingLabel, { color: palette.textMuted }]}>
                  {verifying ? 'Verifying payment signature…' : 'Processing payment…'}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Action buttons */}
          <View style={styles.footer}>
            {checkoutData.demoMode ? (
              <Button
                label={processing ? 'Confirming…' : 'Complete Demo Payment'}
                onPress={handleSimulateDemoPayment}
                loading={processing}
                fullWidth
              />
            ) : (
              <Button
                label={processing ? 'Launching Razorpay…' : `Pay ₹${checkoutData.amount.toLocaleString('en-IN')}`}
                onPress={() => void triggerRazorpayCheckout()}
                loading={processing || verifying}
                fullWidth
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  closeBtn: { padding: 4 },
  body: { gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.sm },
  title: { ...typography.heading, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  amount: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  demoText: { fontSize: 12, lineHeight: 17, flex: 1 },
  infoBox: { alignItems: 'center', marginTop: spacing.xs },
  infoText: { fontSize: 12 },
  loadingContainer: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  loadingLabel: { fontSize: 13, fontWeight: '500' },
  footer: { marginTop: spacing.xs },
});
