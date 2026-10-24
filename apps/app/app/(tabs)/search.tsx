import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { reelsApi } from '@reelbazaar/api';
import { CATEGORIES, type Reel } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { ReelResultCard } from '@/components/ReelResultCard';
import { radius, spacing, TAB_BAR_HEIGHT, typography } from '@/theme';

export default function SearchScreen() {
  const { palette } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [results, setResults] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reelsApi.getFeed(undefined, undefined);
      setResults(res.reels || []);
      setSearched(false);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const run = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        void loadTrending();
        return;
      }
      setLoading(true);
      try {
        const res = await reelsApi.search(q, 30);
        setResults(res.reels);
        setSearched(true);
      } catch (err) {
        console.error('Search failed:', err);
        showToast('Search failed', 'error');
      } finally {
        setLoading(false);
      }
    },
    [loadTrending, showToast]
  );

  useEffect(() => {
    if (!query.trim()) {
      void loadTrending();
      return;
    }
    const timer = setTimeout(() => void run(query), 350);
    return () => clearTimeout(timer);
  }, [query, run, loadTrending]);

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: palette.text }]}>Discover</Text>
          <View style={[styles.badgePill, { backgroundColor: palette.accentSoft, borderColor: palette.accentGlow }]}>
            <Ionicons name="flame" size={12} color={palette.accent} />
            <Text style={[styles.badgeText, { color: palette.accent }]}>Curated Drops</Text>
          </View>
        </View>

        <View
          style={[
            styles.field,
            {
              backgroundColor: palette.inputBg,
              borderColor: palette.borderStrong,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={palette.accent} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setActive(null);
            }}
            placeholder="Search reels, luxury brands, creators…"
            placeholderTextColor={palette.textMuted}
            style={[styles.input, { color: palette.text }]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search"
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setActive(null);
              }}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={palette.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => {
            const on = active === item;
            return (
              <Pressable
                onPress={() => {
                  const next = on ? null : item;
                  setActive(next);
                  setQuery(next ?? '');
                }}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: on ? palette.accent : palette.borderStrong,
                    backgroundColor: on ? palette.accent : palette.cardElevated,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: on ? palette.textOnAccent : palette.textSecondary },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      {loading && !results.length ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.grid}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.sectionHeader, { color: palette.textMuted }]}>
                {searched ? `RESULTS FOR "${query.toUpperCase()}"` : 'TRENDING NOW'}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <View style={[styles.emptyCircle, { backgroundColor: palette.accentSoft }]}>
                <Ionicons name="search-outline" size={28} color={palette.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: palette.text }]}>
                {searched ? 'No reels matched that query' : 'Explore trending fashion'}
              </Text>
              <Text style={[styles.emptySub, { color: palette.textMuted }]}>
                Try searching for a category like Women, Footwear, or a brand handle.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <ReelResultCard reel={item} onPress={() => router.push(`/reel/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    ...typography.title,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 48,
  },
  input: { flex: 1, ...typography.body, paddingVertical: 0 },
  chips: { gap: spacing.sm, paddingBottom: spacing.xs },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { ...typography.caption, fontWeight: '700' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: spacing.sm,
  },
  grid: { gap: spacing.md },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
