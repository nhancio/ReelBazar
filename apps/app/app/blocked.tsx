/**
 * Blocked accounts — the unblock side of the moderation requirement. Review checks that a
 * block can be undone, not just applied.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { moderationApi, type BlockedUser } from '@reelbazaar/api';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { radius, spacing, typography } from '@/theme';

export default function BlockedScreen() {
  const { palette } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await moderationApi.getBlocked();
      setUsers(res.users);
    } catch (err) {
      console.error('Failed to load blocked accounts:', err);
      showToast('Could not load blocked accounts', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = useCallback(
    async (user: BlockedUser) => {
      setPending(user.id);
      // Optimistic: the row leaves immediately, and comes back if the call fails.
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      try {
        await moderationApi.toggleBlock(user.id);
        showToast(`Unblocked ${user.username ?? user.name ?? 'account'}`, 'success');
      } catch (err) {
        console.error('Unblock failed:', err);
        showToast('Could not unblock', 'error');
        setUsers((prev) => [...prev, user]);
      } finally {
        setPending(null);
      }
    },
    [showToast]
  );

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Blocked accounts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : !users.length ? (
        <View style={styles.centre}>
          <Ionicons name="checkmark-circle-outline" size={38} color={palette.textMuted} />
          <Text style={[styles.empty, { color: palette.textMuted }]}>
            You haven’t blocked anyone.
          </Text>
          <Text style={[styles.emptyHint, { color: palette.textMuted }]}>
            Blocking someone hides their reels from your feed and stops them following you.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}>
          {users.map((user) => (
            <View key={user.id} style={[styles.row, { backgroundColor: palette.card }]}>
              <Avatar uri={user.avatarUrl} name={user.name} size={42} />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: palette.text }]} numberOfLines={1}>
                  {user.name ?? 'Account'}
                </Text>
                {user.username ? (
                  <Text style={[styles.rowHandle, { color: palette.textMuted }]} numberOfLines={1}>
                    @{user.username}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => void unblock(user)}
                disabled={pending === user.id}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${user.username ?? user.name ?? 'account'}`}
                style={({ pressed }) => [
                  styles.unblock,
                  { borderColor: palette.borderInteractive },
                  (pressed || pending === user.id) && { opacity: 0.5 },
                ]}
              >
                <Text style={[styles.unblockText, { color: palette.text }]}>Unblock</Text>
              </Pressable>
            </View>
          ))}
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { ...typography.label, fontSize: 16, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 26 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
  },
  empty: { ...typography.body },
  emptyHint: { ...typography.caption, textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  rowText: { flex: 1 },
  rowName: { ...typography.label, fontSize: 15 },
  rowHandle: { ...typography.caption, fontSize: 12 },
  unblock: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unblockText: { ...typography.caption, fontWeight: '700' },
});
