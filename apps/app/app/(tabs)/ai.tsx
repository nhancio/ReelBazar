import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
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
import * as Haptics from 'expo-haptics';
import { reelsApi } from '@reelbazaar/api';
import type { Reel } from '@reelbazaar/config';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { ReelResultCard } from '@/components/ReelResultCard';
import { GlassSurface } from '@/components/GlassSurface';
import { radius, spacing, TAB_BAR_HEIGHT, typography } from '@/theme';

const SUGGESTIONS = [
  'Red lehenga for a wedding',
  'Everyday cotton kurtis',
  'Streetwear co-ord sets',
  'Party wear under ₹2000',
  'Statement footwear & heels',
];

export default function AskScreen() {
  const { palette } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [results, setResults] = useState<Reel[] | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const voice = useVoiceInput(setQuery);

  const ask = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (!q || loading) return;

      voice.stop();
      setLoading(true);
      setAsked(q);
      setResults(null);

      try {
        const res = await reelsApi.search(q, 24);
        setResults(res.reels);
        setTerms(res.terms);
        if (Platform.OS !== 'web') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } catch (err) {
        console.error('Search failed:', err);
        showToast('Could not search right now', 'error');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [loading, showToast, voice]
  );

  const onMicPress = useCallback(() => {
    if (!voice.supported) {
      showToast(voice.unavailableReason ?? 'Voice input is unavailable', 'info');
      return;
    }
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    if (voice.listening) voice.stop();
    else voice.start();
  }, [voice, showToast]);

  const composerBottom = TAB_BAR_HEIGHT + Math.max(insets.bottom, 10) + spacing.md;

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={[styles.aiBadge, { backgroundColor: palette.accentSoft, borderColor: palette.accentGlow }]}>
            <Ionicons name="sparkles" size={12} color={palette.accent} />
            <Text style={[styles.aiBadgeText, { color: palette.accent }]}>RAVA AI STYLIST</Text>
          </View>
          {results !== null ? (
            <Pressable
              onPress={() => {
                setResults(null);
                setAsked(null);
                setQuery('');
              }}
              hitSlop={8}
            >
              <Text style={[styles.resetText, { color: palette.accent }]}>New Prompt</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={[styles.title, { color: palette.text }]}>Ask Rava</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Describe the vibe, occasion, or outfit you want to wear. We will curate shoppable reels in seconds.
        </Text>
      </View>

      {results === null && !loading ? (
        <ScrollView
          contentContainerStyle={[styles.suggestWrap, { paddingBottom: composerBottom + 80 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.suggestLabel, { color: palette.textMuted }]}>POPULAR STYLE PROMPTS</Text>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setQuery(s);
                void ask(s);
              }}
              style={({ pressed }) => [
                styles.suggestion,
                {
                  borderColor: palette.borderStrong,
                  backgroundColor: palette.cardElevated,
                },
                pressed && { opacity: 0.75, borderColor: palette.accent },
              ]}
            >
              <View style={[styles.suggestionIcon, { backgroundColor: palette.accentSoft }]}>
                <Ionicons name="sparkles" size={15} color={palette.accent} />
              </View>
              <Text style={[styles.suggestionText, { color: palette.text }]}>{s}</Text>
              <Ionicons name="arrow-forward" size={16} color={palette.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      ) : loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={[styles.thinking, { color: palette.textSecondary }]}>
            Curating looks for “{asked}”…
          </Text>
        </View>
      ) : (
        <FlatList
          data={results ?? []}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.grid}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: composerBottom + 80 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.resultHead}>
              <Text style={[styles.resultCount, { color: palette.text }]}>
                {(results ?? []).length
                  ? `${(results ?? []).length} look${(results ?? []).length === 1 ? '' : 's'} curated for “${asked}”`
                  : `Nothing matched “${asked}”`}
              </Text>
              {terms.length ? (
                <Text style={[styles.terms, { color: palette.textMuted }]}>
                  Matched tags: {terms.join(', ')}
                </Text>
              ) : null}
              {!(results ?? []).length ? (
                <Text style={[styles.terms, { color: palette.textMuted }]}>
                  Try fewer words, or a category like “footwear” or “women”.
                </Text>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <ReelResultCard reel={item} onPress={() => router.push(`/reel/${item.id}`)} />
          )}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.composerWrap, { bottom: composerBottom }]}
      >
        <GlassSurface intensity={85} style={styles.composer}>
          <View style={styles.composerRow}>
            <Ionicons name="sparkles" size={18} color={palette.accent} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={voice.listening ? 'Listening…' : 'Ask for an outfit, occasion, or brand…'}
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { color: palette.text }]}
              returnKeyType="search"
              onSubmitEditing={() => void ask(query)}
              multiline={false}
              accessibilityLabel="Ask Rava"
            />

            <Pressable
              onPress={onMicPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={voice.listening ? 'Stop listening' : 'Ask with your voice'}
              accessibilityState={{ disabled: !voice.supported }}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: voice.listening ? palette.danger : palette.cardElevated },
                !voice.supported && styles.dimmed,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={voice.listening ? 'stop' : 'mic-outline'}
                size={18}
                color={voice.listening ? '#fff' : palette.text}
              />
            </Pressable>

            <Pressable
              onPress={() => void ask(query)}
              disabled={!query.trim() || loading}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: palette.accent },
                (!query.trim() || loading) && styles.dimmed,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          </View>
        </GlassSurface>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.md, gap: 4 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
  },
  title: { ...typography.title, fontSize: 30, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { ...typography.caption, lineHeight: 19 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  thinking: { ...typography.caption, fontWeight: '600' },
  suggestWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
  suggestLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionText: { ...typography.body, fontWeight: '600', flex: 1 },
  resultHead: { paddingVertical: spacing.md, gap: 2 },
  resultCount: { ...typography.label, fontSize: 15, fontWeight: '800' },
  terms: { ...typography.caption, fontSize: 12 },
  grid: { gap: spacing.md },
  composerWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  composer: { borderRadius: radius.pill },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 6,
    paddingLeft: spacing.lg,
  },
  input: { flex: 1, ...typography.body, paddingVertical: 8, minHeight: 40 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.4 },
});
