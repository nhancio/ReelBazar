import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  moderationApi,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
} from '@reelbazaar/api';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { radius, spacing, typography } from '@/theme';

export interface ModerationTarget {
  targetType: 'reel' | 'user';
  targetId: string;
  userId?: string | null;
  userLabel?: string;
}

interface Props {
  visible: boolean;
  target: ModerationTarget | null;
  guestMode?: boolean;
  onRequireAuth?: () => void;
  onClose: () => void;
  onBlocked?: (userId: string) => void;
}

export function ModerationSheet({
  visible,
  target,
  guestMode,
  onRequireAuth,
  onClose,
  onBlocked,
}: Props) {
  const { palette } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'menu' | 'reasons'>('menu');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setStep('menu');
    onClose();
  };

  if (!target) return null;

  const handleLabel = target.userLabel ? `@${target.userLabel.replace(/^@/, '')}` : 'this account';
  const canBlock = Boolean(target.userId);

  const submitReport = async (reason: ReportReason) => {
    if (guestMode) {
      close();
      onRequireAuth?.();
      return;
    }
    setBusy(true);
    try {
      await moderationApi.report({
        targetType: target.targetType,
        targetId: target.targetId,
        reason,
      });
      showToast('Report submitted. We review reports within 24 hours.', 'success');
      close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not submit report';
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const runBlock = async () => {
    if (!target.userId) return;
    if (guestMode) {
      close();
      onRequireAuth?.();
      return;
    }
    setBusy(true);
    try {
      const res = await moderationApi.toggleBlock(target.userId);
      if (res.blocked) {
        showToast(`Blocked ${handleLabel}`, 'success');
        onBlocked?.(target.userId);
      } else {
        showToast(`Unblocked ${handleLabel}`, 'info');
      }
      close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not block user';
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmBlock = () => {
    if (!target.userId) return;
    const message = `You will no longer see reels from ${handleLabel}, and they will not be able to follow you. You can unblock them anytime in Settings.`;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Block ${handleLabel}?\n\n${message}`)) {
        void runBlock();
      }
      return;
    }
    Alert.alert(`Block ${handleLabel}?`, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => void runBlock() },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={[styles.backdrop, { backgroundColor: palette.scrim }]}>
        <Pressable style={styles.dismiss} onPress={close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.sheet,
              borderTopColor: palette.borderStrong,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: palette.borderStrong }]} />
          </View>

          <View style={[styles.header, { borderBottomColor: palette.border }]}>
            {step === 'reasons' ? (
              <Pressable
                onPress={() => setStep('menu')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={22} color={palette.text} />
              </Pressable>
            ) : (
              <View style={styles.spacer} />
            )}
            <Text style={[styles.title, { color: palette.text }]}>
              {step === 'menu'
                ? 'Safety & Moderation'
                : `Why are you reporting this ${target.targetType}?`}
            </Text>
            <Pressable
              onPress={close}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={palette.textMuted} />
            </Pressable>
          </View>

          {step === 'menu' ? (
            <View style={styles.menuList}>
              <Pressable
                onPress={() => {
                  if (guestMode) {
                    close();
                    onRequireAuth?.();
                    return;
                  }
                  setStep('reasons');
                }}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.menuRow,
                  { backgroundColor: palette.cardElevated, borderColor: palette.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="flag-outline" size={20} color={palette.warning} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: palette.text }]}>
                    Report {target.targetType === 'reel' ? 'reel' : 'account'}
                  </Text>
                  <Text style={[styles.rowSub, { color: palette.textMuted }]}>
                    Flag inappropriate, misleading, or harmful content
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
              </Pressable>

              {canBlock ? (
                <Pressable
                  onPress={confirmBlock}
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.menuRow,
                    { backgroundColor: palette.dangerSoft, borderColor: palette.danger },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons name="ban-outline" size={20} color={palette.danger} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: palette.danger }]}>
                      Block {handleLabel}
                    </Text>
                    <Text style={[styles.rowSub, { color: palette.textSecondary }]}>
                      Hide their reels from your feed and remove follows
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <ScrollView style={styles.reasonsScroll} contentContainerStyle={styles.reasonsList}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => void submitReport(reason)}
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.reasonRow,
                    { borderBottomColor: palette.border },
                    (pressed || busy) && { opacity: 0.55 },
                  ]}
                >
                  <Text style={[styles.reasonText, { color: palette.text }]}>
                    {REPORT_REASON_LABELS[reason]}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '78%',
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 38, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  spacer: { width: 22 },
  title: { ...typography.label, fontSize: 15, flex: 1, textAlign: 'center' },
  menuList: { padding: spacing.lg, gap: spacing.md },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, lineHeight: 16 },
  reasonsScroll: { maxHeight: 380 },
  reasonsList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reasonText: { fontSize: 15, fontWeight: '500' },
});
