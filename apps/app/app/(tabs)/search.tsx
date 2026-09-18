/**
 * Search tab — the same /reels/search endpoint the AI tab uses, with a plain query field
 * instead of a conversational one. Was `discover.tsx`; renamed with the nav change.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setSearched(false);
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
    [showToast]
  );

  // Debounced as-you-type: one request per pause, not one per keystroke.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    const timer = setTimeout(() => void run(query), 350);
    return () => clearTimeout(timer);
  }, [query, run]);

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={[styles.field, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Ionicons name="search" size={17} color={palette.textMuted} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setActive(null);
            }}
            placeholder="Search reels, brands, creators"
            placeholderTextColor={palette.textMuted}
            style={[styles.input, { color: palette.text }]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={17} color={palette.textMuted} />
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
                    borderColor: on ? 'transparent' : palette.borderInteractive,
                    backgroundColor: on ? palette.accentStrong : palette.card,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: on ? palette.textOnAccent : palette.text }]}
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
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.grid}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom + spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={{ color: palette.textMuted }}>
                {searched ? 'No reels matched that.' : 'Search for something to wear.'}
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
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
  },
  input: { flex: 1, ...typography.body, paddingVertical: 0 },
  chips: { gap: spacing.sm, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { ...typography.caption, fontWeight: '600' },
  grid: { gap: spacing.md },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
});
