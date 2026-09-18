/**
 * Ask Rava — natural-language reel discovery by text or voice.
 *
 * What this is: the query goes to GET /reels/search, which scores reels server-side across
 * category, brand tag, caption and creator, and returns them ranked.
 *
 * What this is NOT (yet): an LLM. There is no model call here, so no API key ships in the
 * bundle and there is no per-query cost. It handles "show me red lehengas" or "streetwear
 * under budget" well because those are keyword-shaped. It cannot reason ("what should I wear
 * to a beach wedding in Goa?"). Swapping in a model means changing only the backend handler —
 * this screen already speaks in questions and answers.
 */
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
  'Party wear under 2000',
  'Footwear for monsoon',
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

  // Dictation writes straight into the field so the person can edit before sending.
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
        <Text style={[styles.title, { color: palette.text }]}>Ask Rava</Text>
        <Text style={[styles.subtitle, { color: palette.textMuted }]}>
          Describe what you want to wear. We will find the reels.
        </Text>
      </View>

      {results === null && !loading ? (
        <ScrollView contentContainerStyle={styles.suggestWrap} keyboardShouldPersistTaps="handled">
          <Text style={[styles.suggestLabel, { color: palette.textMuted }]}>Try asking</Text>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => {
                setQuery(s);
                void ask(s);
              }}
              style={({ pressed }) => [
                styles.suggestion,
                { borderColor: palette.borderInteractive, backgroundColor: palette.card },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="sparkles-outline" size={16} color={palette.accent} />
              <Text style={[styles.suggestionText, { color: palette.text }]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : loading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color={palette.accent} />
          <Text style={[styles.thinking, { color: palette.textMuted }]}>
            Looking for “{asked}”
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
                  ? `${(results ?? []).length} reel${(results ?? []).length === 1 ? '' : 's'} for “${asked}”`
                  : `Nothing matched “${asked}”`}
              </Text>
              {terms.length ? (
                <Text style={[styles.terms, { color: palette.textMuted }]}>
                  Searched: {terms.join(', ')}
                </Text>
              ) : null}
              {!(results ?? []).length ? (
                <Text style={[styles.terms, { color: palette.textMuted }]}>
                  Try fewer words, or a category like “footwear” or “beauty”.
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
        <GlassSurface intensity={80} style={styles.composer}>
          <View style={styles.composerRow}>
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={voice.listening ? 'Listening…' : 'Ask for anything to wear'}
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
                voice.listening && { backgroundColor: palette.danger },
                !voice.supported && styles.dimmed,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={voice.listening ? 'stop' : 'mic'}
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
                { backgroundColor: palette.accentStrong },
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
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.title, fontSize: 30 },
  subtitle: { ...typography.caption, marginTop: spacing.xs },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  thinking: { ...typography.caption },
  suggestWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md },
  suggestLabel: { ...typography.label, marginBottom: spacing.xs },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { ...typography.body, flex: 1 },
  resultHead: { paddingVertical: spacing.md, gap: 2 },
  resultCount: { ...typography.label, fontSize: 15 },
  terms: { ...typography.caption, fontSize: 12 },
  grid: { gap: spacing.md },
  composerWrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  composer: { borderRadius: radius.card },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    paddingLeft: spacing.lg,
  },
  input: { flex: 1, ...typography.body, paddingVertical: spacing.md, minHeight: 40 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  dimmed: { opacity: 0.45 },
});
