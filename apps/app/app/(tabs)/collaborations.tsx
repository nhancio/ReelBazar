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
import { collaborationsApi } from '@reelbazaar/api';
import type { Collaboration, User } from '@reelbazaar/config';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { NativeSegmentedPicker } from '@/components/NativeUI';
import { radius, spacing, typography } from '@/theme';

export default function CollaborationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const { user, guestMode } = useAuth();
  const { showToast } = useToast();

  const [suggestions, setSuggestions] = useState<Collaboration[]>([]);
  const [myCollabs, setMyCollabs] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'suggestions' | 'active'>('suggestions');
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());

  const isBrand = user?.userType === 'brand' || user?.persona === 'Brand';

  const loadData = useCallback(async () => {
    if (guestMode || !user) {
      setSuggestions([]);
      setMyCollabs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [suggestionsRes, collabsRes] = await Promise.all([
        collaborationsApi.getSuggestions().catch(() => ({ collaborations: [] })),
        collaborationsApi.getMyCollaborations().catch(() => ({ collaborations: [] })),
      ]);
      setSuggestions(suggestionsRes.collaborations || []);
      setMyCollabs(collabsRes.collaborations || []);
    } catch (err) {
      console.error('Failed to load collaborations:', err);
      showToast('Failed to load collaborations', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guestMode, user, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRespond = async (id: string, status: 'accepted' | 'declined') => {
    if (guestMode) return;
    setRespondingIds((prev) => new Set(prev).add(id));

    try {
      const { collaboration } = await collaborationsApi.respond(id, status);
      setSuggestions((prev) => prev.filter((c) => c.id !== id));
      if (status === 'accepted') {
        setMyCollabs((prev) => [...prev, collaboration]);
        showToast('Collaboration accepted!', 'success');
      } else {
        showToast('Passed on collaboration', 'info');
      }
    } catch (err: unknown) {
      console.error('Failed to respond to collaboration:', err);
      const msg = err instanceof Error ? err.message : 'Action failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setRespondingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const activeCollabs = myCollabs.filter((c) => c.status === 'accepted' || c.status === 'pending');

  const renderPartner = (collab: Collaboration): User | null => {
    if (isBrand) return collab.influencer ?? null;
    return collab.brand ?? null;
  };

  if (guestMode || !user) {
    return (
      <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: palette.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Collaborations</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.guestContainer}>
          <View style={[styles.guestIconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="people" size={40} color={palette.accent} />
          </View>
          <Text style={[styles.guestHeading, { color: palette.text }]}>
            Connect with Brands & Creators
          </Text>
          <Text style={[styles.guestSubtitle, { color: palette.textMuted }]}>
            Sign in to access AI-matched collaboration suggestions, partner requests, and active campaigns.
          </Text>
          <Button
            label="Sign in"
            onPress={() => router.push('/auth')}
            style={styles.signInBtn}
            fullWidth
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={[styles.headerSub, { color: palette.textMuted }]}>Matching</Text>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Collaborations</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, { borderBottomColor: palette.border }]}>
        <NativeSegmentedPicker<'suggestions' | 'active'>
          options={[
            { label: `Suggested (${suggestions.length})`, value: 'suggestions' },
            { label: `Active (${activeCollabs.length})`, value: 'active' },
          ]}
          selectedValue={tab}
          onValueChange={setTab}
        />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <LoadingSpinner size="lg" label="Finding collaboration matches..." />
        </View>
      ) : (
        <FlatList
          data={tab === 'suggestions' ? suggestions : activeCollabs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + spacing.xxl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadData();
              }}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons
                name={tab === 'suggestions' ? 'sparkles-outline' : 'briefcase-outline'}
                size={48}
                color={palette.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                {tab === 'suggestions' ? 'No suggestions yet' : 'No active collaborations'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: palette.textMuted }]}>
                {tab === 'suggestions'
                  ? 'We are looking for matching creators and brands for you.'
                  : 'Accepted collaboration proposals will appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const partner = renderPartner(item);
            if (!partner) return null;
            const isResponding = respondingIds.has(item.id);
            const scorePercent = Math.round(item.score || 85);

            if (tab === 'suggestions') {
              return (
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Avatar uri={partner.avatarUrl} name={partner.name} size={48} />
                    <View style={styles.cardHeaderText}>
                      <Text style={[styles.partnerName, { color: palette.text }]} numberOfLines={1}>
                        {partner.name}
                      </Text>
                      <View style={styles.metaRow}>
                        {partner.userType ? (
                          <View
                            style={[
                              styles.typeBadge,
                              {
                                backgroundColor: palette.accentSoft,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.typeBadgeText,
                                {
                                  color: palette.accent,
                                },
                              ]}
                            >
                              {partner.userType.toUpperCase()}
                            </Text>
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.scoreBadge,
                            { backgroundColor: 'rgba(34,197,94,0.15)' },
                          ]}
                        >
                          <Ionicons name="flash" size={11} color="#22c55e" />
                          <Text style={styles.scoreText}>{scorePercent}% Match</Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actionsRow}>
                    <Button
                      label="Accept"
                      variant="primary"
                      loading={isResponding}
                      onPress={() => handleRespond(item.id, 'accepted')}
                      style={styles.actionBtn}
                    />
                    <Button
                      label="Pass"
                      variant="secondary"
                      disabled={isResponding}
                      onPress={() => handleRespond(item.id, 'declined')}
                      style={styles.actionBtn}
                    />
                  </View>
                </View>
              );
            }

            // Active Tab card
            return (
              <Pressable
                onPress={() => partner.id && router.push(`/profile/${partner.id}`)}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Avatar uri={partner.avatarUrl} name={partner.name} size={48} />
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.partnerName, { color: palette.text }]} numberOfLines={1}>
                      {partner.name}
                    </Text>
                    <View style={styles.metaRow}>
                      {partner.userType ? (
                        <View
                          style={[
                            styles.typeBadge,
                            {
                              backgroundColor: palette.accentSoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeBadgeText,
                              {
                                color: palette.accent,
                              },
                            ]}
                          >
                            {partner.userType.toUpperCase()}
                          </Text>
                        </View>
                      ) : null}
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              item.status === 'accepted'
                                ? 'rgba(34,197,94,0.15)'
                                : 'rgba(234,179,8,0.15)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: item.status === 'accepted' ? '#22c55e' : '#eab308',
                            },
                          ]}
                        >
                          {item.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Button
                    label="View Profile"
                    variant="secondary"
                    onPress={() => partner.id && router.push(`/profile/${partner.id}`)}
                    style={styles.viewProfileBtn}
                  />
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
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1, alignItems: 'center' },
  headerSub: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  headerTitle: { ...typography.heading, fontSize: 18, fontWeight: '800' },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: { fontSize: 13 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  listContent: { padding: spacing.md, gap: spacing.md },
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  cardHeaderText: { flex: 1, gap: 4 },
  partnerName: { fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  scoreText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { flex: 1, minHeight: 40 },
  viewProfileBtn: { minHeight: 36, paddingHorizontal: 12 },
  emptyWrap: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  guestIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  guestHeading: { ...typography.heading, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  guestSubtitle: { ...typography.body, fontSize: 14, textAlign: 'center' },
  signInBtn: { marginTop: spacing.md, minHeight: 50 },
});
