import { useEffect, useMemo, useState } from 'react';
import {
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
import { type User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { APP_NAME, PERSONAS, type Persona } from '@reelbazaar/config';
import { authApi } from '@reelbazaar/api';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from '@/components/Button';
import { radius, spacing, typography } from '@/theme';

const INTEREST_OPTIONS = [
  'Fashion',
  'Beauty',
  'Electronics',
  'Lifestyle',
  'Footwear',
  'Accessories',
  'Men',
  'Women',
  'Kids',
];

const PERSONA_INFO: Record<Persona, { icon: keyof typeof Ionicons.glyphMap; desc: string }> = {
  Creator: { icon: 'videocam', desc: 'Create reels & grow your audience' },
  Brand: { icon: 'business', desc: 'Showcase products & find creators' },
  User: { icon: 'person', desc: 'Discover & shop trending products' },
};

async function syncProfileToBackend(
  firebaseUser: FirebaseUser,
  payload: {
    username: string;
    name: string;
    interests: string[];
    productCategories: string[];
    persona: Persona;
  }
) {
  try {
    await authApi.updateProfile({
      username: payload.username,
      name: payload.name,
      interests: payload.interests,
      productCategories: payload.productCategories,
      persona: payload.persona,
    });
  } catch (apiErr: unknown) {
    const msg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    if (!msg.includes('User not registered')) throw apiErr;
    await authApi.register({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email ?? null,
      name: payload.name,
      username: payload.username,
      interests: payload.interests,
      productCategories: payload.productCategories,
      persona: payload.persona,
    });
  }
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, theme } = useTheme();
  const { user, firebaseUser, guestMode, refreshUser } = useAuth();

  const existingInterests = useMemo(
    () => (user?.interests?.length ? user.interests : user?.productCategories || []),
    [user?.interests, user?.productCategories]
  );

  const [username, setUsername] = useState(
    user?.username || (user?.name ? user.name.replace(/\s+/g, '').toLowerCase() : '')
  );
  const [selectedPersona, setSelectedPersona] = useState<Persona>(user?.persona || 'Creator');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(existingInterests);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    setUsername(user.username || (user.name ? user.name.replace(/\s+/g, '').toLowerCase() : ''));
    if (existingInterests.length) setSelectedInterests(existingInterests);
    if (user.persona) setSelectedPersona(user.persona);
  }, [user, existingInterests]);

  useEffect(() => {
    if (!firebaseUser && !guestMode) {
      router.replace('/auth');
    }
  }, [firebaseUser, guestMode, router]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) =>
      current.includes(interest) ? current.filter((i) => i !== interest) : [...current, interest]
    );
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    setError('');

    const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!sanitizedUsername.trim()) {
      setError('Please choose a valid username.');
      return;
    }
    if (selectedInterests.length === 0) {
      setError('Please select at least one interest.');
      return;
    }
    if (!firebaseUser) return;

    setLoading(true);
    try {
      const payload = {
        username: sanitizedUsername,
        name: sanitizedUsername,
        interests: selectedInterests,
        productCategories: selectedInterests,
        persona: selectedPersona,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', firebaseUser.uid), payload, { merge: true });
      await refreshUser(firebaseUser);
      router.replace('/');

      void syncProfileToBackend(firebaseUser, payload).catch((err) => {
        console.warn('[onboarding] backend sync failed (profile saved in app):', err);
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme !== 'light';
  const showSelectionError = submitted && selectedInterests.length === 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.fill, { backgroundColor: palette.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollWrap,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#141416' : '#ffffff',
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: palette.text }]}>Welcome to {APP_NAME}! 👋</Text>
          <Text style={[styles.subtitle, { color: palette.textMuted }]}>
            Let&apos;s set up your profile quickly.
          </Text>

          {/* Username */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.textMuted }]}>USERNAME</Text>
            <TextInput
              value={username}
              onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase())}
              placeholder="e.g. fashionguru"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: palette.borderInteractive,
                  color: palette.text,
                },
              ]}
            />
          </View>

          {/* Persona selector */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.textMuted }]}>SELECT YOUR PERSONA</Text>
            <View style={styles.personaList}>
              {PERSONAS.map((p) => {
                const isSelected = selectedPersona === p;
                const info = PERSONA_INFO[p];
                return (
                  <Pressable
                    key={p}
                    onPress={() => setSelectedPersona(p)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.personaRow,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(168,85,247,0.15)'
                            : 'rgba(168,85,247,0.08)'
                          : isDark
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(0,0,0,0.03)',
                        borderColor: isSelected ? palette.accent : palette.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.personaIconWrap,
                        {
                          backgroundColor: isSelected
                            ? palette.accentSoft
                            : isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.06)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={info.icon}
                        size={20}
                        color={isSelected ? palette.accent : palette.textSecondary}
                      />
                    </View>
                    <View style={styles.personaText}>
                      <Text
                        style={[
                          styles.personaName,
                          { color: isSelected ? palette.text : palette.textSecondary },
                        ]}
                      >
                        {p}
                      </Text>
                      <Text style={[styles.personaDesc, { color: palette.textMuted }]}>
                        {info.desc}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={palette.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Interests Chips */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: palette.textMuted }]}>
              WHAT ARE YOU INTERESTED IN?
            </Text>
            <View style={styles.chipsWrap}>
              {INTEREST_OPTIONS.map((opt) => {
                const isSelected = selectedInterests.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    onPress={() => toggleInterest(opt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected
                          ? palette.text
                          : isDark
                            ? 'rgba(255,255,255,0.07)'
                            : 'rgba(0,0,0,0.05)',
                        borderColor: isSelected ? palette.text : palette.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: isSelected
                            ? palette.background
                            : isDark
                              ? 'rgba(255,255,255,0.7)'
                              : 'rgba(0,0,0,0.75)',
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {showSelectionError ? (
              <Text style={[styles.errorText, { color: palette.danger }]}>
                Please select at least one interest.
              </Text>
            ) : null}
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: palette.danger }]}>{error}</Text>
          ) : null}

          <Button
            label="Save & Continue"
            onPress={handleSubmit}
            loading={loading}
            disabled={!username.trim()}
            fullWidth
            style={styles.submitButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollWrap: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
  },
  title: { ...typography.heading, fontSize: 24, fontWeight: '800' },
  subtitle: { ...typography.body, fontSize: 14, marginTop: -4 },
  section: { gap: spacing.xs },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, paddingLeft: 2 },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  personaList: { gap: spacing.sm },
  personaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.md,
  },
  personaIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personaText: { flex: 1, gap: 2 },
  personaName: { fontSize: 15, fontWeight: '700' },
  personaDesc: { fontSize: 12 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  errorText: { fontSize: 13, marginTop: 4 },
  submitButton: { marginTop: spacing.sm, minHeight: 52 },
});
