import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { User } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { Avatar } from '@/components/Avatar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { radius, spacing, typography } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  users: User[];
  loading: boolean;
  currentUserId?: string;
  followingMap?: Record<string, boolean>;
  followPendingIds?: Set<string>;
  guestMode?: boolean;
  onClose: () => void;
  onUserPress: (userId: string) => void;
  onToggleFollow?: (userId: string) => void;
}

export function UserListModal({
  visible,
  title,
  users,
  loading,
  currentUserId,
  followingMap = {},
  followPendingIds = new Set(),
  guestMode = false,
  onClose,
  onUserPress,
  onToggleFollow,
}: Props) {
  const insets = useSafeAreaInsets();
  const { palette, theme } = useTheme();
  const isDark = theme !== 'light';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: palette.background,
            paddingTop: insets.top + spacing.xs,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <View style={styles.headerBtn} />
          <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.headerBtn}
          >
            <Ionicons name="close" size={24} color={palette.text} />
          </Pressable>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.centerWrap}>
            <LoadingSpinner size="lg" label="Loading users..." />
          </View>
        ) : users.length === 0 ? (
          <View style={styles.centerWrap}>
            <Ionicons name="people-outline" size={48} color={palette.textMuted} />
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>No users found</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isMe = item.id === currentUserId;
              const isFollowing = Boolean(followingMap[item.id]);
              const pending = followPendingIds.has(item.id);
              const handle = item.username || item.name?.replace(/\s+/g, '').toLowerCase() || 'user';

              return (
                <View style={[styles.userRow, { borderBottomColor: palette.border }]}>
                  <Pressable
                    style={styles.userInfo}
                    onPress={() => {
                      onClose();
                      onUserPress(item.id);
                    }}
                  >
                    <Avatar uri={item.avatarUrl} name={item.name} size={44} />
                    <View style={styles.userText}>
                      <Text style={[styles.userName, { color: palette.text }]} numberOfLines={1}>
                        @{handle}
                      </Text>
                      <Text style={[styles.userSub, { color: palette.textMuted }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  </Pressable>

                  {!isMe && !guestMode && onToggleFollow ? (
                    <Pressable
                      onPress={() => onToggleFollow(item.id)}
                      disabled={pending}
                      style={[
                        styles.followBtn,
                        {
                          backgroundColor: isFollowing
                            ? isDark
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(0,0,0,0.06)'
                            : palette.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.followBtnText,
                          { color: isFollowing ? palette.text : palette.textOnAccent },
                        ]}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.heading, fontSize: 16, fontWeight: '700' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { fontSize: 14 },
  listContent: { paddingHorizontal: spacing.md },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1, marginRight: spacing.sm },
  userText: { flex: 1, gap: 2 },
  userName: { fontSize: 14, fontWeight: '700' },
  userSub: { fontSize: 12 },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
    minWidth: 84,
    alignItems: 'center',
  },
  followBtnText: { fontSize: 12, fontWeight: '700' },
});
