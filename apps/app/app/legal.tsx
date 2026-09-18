/**
 * Terms and Privacy, rendered from lib/legalContent.ts. One screen, two documents, selected
 * by the `doc` route param so both are deep-linkable (rava://legal?doc=privacy).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PRIVACY, TERMS, type LegalDoc } from '@/lib/legalContent';
import { useTheme } from '@/context/ThemeContext';
import { spacing, typography } from '@/theme';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const document: LegalDoc = doc === 'privacy' ? PRIVACY : TERMS;

  return (
    <View style={[styles.fill, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={26} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
          {document.title}
        </Text>
        {/* Balances the back button so the title stays optically centred. */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: insets.bottom + spacing.xxl * 2 },
        ]}
        // iOS momentum + bounce is expected in a long legal read; keep the native feel.
        showsVerticalScrollIndicator={Platform.OS !== 'web'}
      >
        <Text style={[styles.intro, { color: palette.textSecondary }]}>{document.intro}</Text>

        {document.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={[styles.heading, { color: palette.text }]}>{section.heading}</Text>
            {section.body.map((paragraph, i) => (
              <Text key={i} style={[styles.paragraph, { color: palette.textSecondary }]}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <Pressable
          onPress={() =>
            router.replace(doc === 'privacy' ? '/legal?doc=terms' : '/legal?doc=privacy')
          }
          style={({ pressed }) => [
            styles.switchDoc,
            { borderColor: palette.borderInteractive },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={[styles.switchDocText, { color: palette.accent }]}>
            {doc === 'privacy' ? 'Read the Terms & Conditions' : 'Read the Privacy Policy'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={palette.accent} />
        </Pressable>
      </ScrollView>
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
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  intro: { ...typography.caption, lineHeight: 20, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  heading: { ...typography.label, fontSize: 15, marginBottom: spacing.sm },
  paragraph: { ...typography.caption, fontSize: 13.5, lineHeight: 21, marginBottom: spacing.sm },
  switchDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  switchDocText: { ...typography.label },
});
