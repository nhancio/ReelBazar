/**
 * Port of apps/web-app/src/pages/AuthPage.tsx.
 *
 * Adds Sign in with Apple, which the web app did not have. This is not optional: App Store
 * Guideline 4.8 requires an equivalent privacy-preserving login option wherever a
 * third-party social login (Google, here) is offered. Shipping without it is a rejection.
 */
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, updateProfile } from 'firebase/auth';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { APP_NAME } from '@reelbazaar/config';
import { auth } from '@/lib/firebase';
import { signInWithGoogle } from '@/lib/googleSignIn';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/Button';
import { radius, spacing, typography } from '@/theme';

export default function AuthScreen() {
  const { enterGuestMode, refreshUser, clearAuthError, authError } = useAuth();
  const { palette, theme } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);

  const handleGoogle = useCallback(async () => {
    clearAuthError();
    setBusy('google');
    try {
      await signInWithGoogle();
      await refreshUser();
    } catch (err) {
      console.error('Google sign-in failed:', err);
      const code = (err as { code?: string })?.code ?? '';
      if (!/cancel/i.test(code) && !/cancel/i.test(String(err))) {
        showToast('Could not sign in with Google', 'error');
      }
    } finally {
      setBusy(null);
    }
  }, [clearAuthError, refreshUser, showToast]);

  const handleApple = useCallback(async () => {
    clearAuthError();
    setBusy('apple');
    try {
      const rawNonce = Crypto.getRandomValues(new Uint8Array(16))
        .reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('Apple sign-in returned no identity token.');
      const provider = new OAuthProvider('apple.com');
      const userCred = await signInWithCredential(
        auth,
        provider.credential({
          idToken: credential.identityToken,
          rawNonce,
        })
      );

      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (fullName && userCred.user && !userCred.user.displayName) {
        await updateProfile(userCred.user, { displayName: fullName }).catch(() => {});
      }

      await refreshUser(userCred.user);
    } catch (err) {
      const code = (err as { code?: string | number })?.code ?? '';
      const msg = err instanceof Error ? err.message : String(err);
      const isCancelled =
        code === 'ERR_REQUEST_CANCELED' ||
        code === 'ERR_CANCELED' ||
        code === 1001 ||
        code === '1001' ||
        /cancel|1001/i.test(String(code)) ||
        /cancel/i.test(msg);

      if (!isCancelled) {
        console.error('Apple sign-in failed:', err);
        showToast('Could not sign in with Apple', 'error');
      }
    } finally {
      setBusy(null);
    }
  }, [clearAuthError, refreshUser, showToast]);

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette.background,
          paddingTop: insets.top + spacing.xxl,
          paddingBottom: insets.bottom + spacing.xl,
        },
      ]}
    >
      {/* Ambient Rava Pink Glow */}
      <View style={[styles.ambientGlow, { backgroundColor: palette.accentSoft }]} pointerEvents="none" />

      <View style={styles.brandBlock}>
        <View style={[styles.logoFrame, { borderColor: palette.borderInteractive, backgroundColor: palette.card }]}>
          <Image
            source={require('../assets/images/icon.png')}
            style={styles.logoImg}
            contentFit="cover"
          />
        </View>

        <View style={[styles.eyebrowPill, { backgroundColor: palette.accentSoft, borderColor: palette.borderInteractive }]}>
          <Ionicons name="sparkles" size={12} color={palette.accent} />
          <Text style={[styles.eyebrowText, { color: palette.accent }]}>SOCIAL FASHION BOUTIQUE</Text>
        </View>

        <Text style={[styles.brand, { color: palette.text }]}>{APP_NAME}</Text>
        <Text style={[styles.tagline, { color: palette.textSecondary }]}>
          Shop the fashion you scroll. Discover creator-curated drops & instant checkout.
        </Text>

        <View style={styles.featurePills}>
          {[
            { icon: 'flash-outline' as const, label: 'Instant Buy' },
            { icon: 'sparkles-outline' as const, label: 'AI Stylist' },
            { icon: 'wallet-outline' as const, label: 'Creator Rewards' },
          ].map((item) => (
            <View
              key={item.label}
              style={[styles.featureChip, { backgroundColor: palette.cardElevated, borderColor: palette.border }]}
            >
              <Ionicons name={item.icon} size={13} color={palette.accent} />
              <Text style={[styles.featureChipText, { color: palette.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Google"
          icon="logo-google"
          size="lg"
          onPress={handleGoogle}
          loading={busy === 'google'}
          disabled={busy !== null}
          fullWidth
        />

        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              theme === 'light'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            }
            cornerRadius={999}
            style={styles.appleButton}
            onPress={handleApple}
          />
        ) : null}

        <Button
          label="Browse as guest"
          variant="secondary"
          size="lg"
          onPress={() => enterGuestMode()}
          disabled={busy !== null}
          fullWidth
        />
      </View>

      {authError ? (
        <View style={[styles.error, { backgroundColor: palette.dangerSoft }]}>
          <Ionicons name="alert-circle-outline" size={16} color={palette.danger} />
          <Text style={[styles.errorText, { color: palette.danger }]}>{authError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xl, position: 'relative' },
  ambientGlow: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.65,
  },
  brandBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  logoFrame: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  logoImg: { width: '100%', height: '100%' },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  eyebrowText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  brand: { fontSize: 46, fontWeight: '800', letterSpacing: -1.2 },
  tagline: { ...typography.subtitle, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 310 },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  featureChipText: { fontSize: 12, fontWeight: '600' },
  actions: { gap: spacing.md },
  appleButton: { width: '100%', height: 54 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  errorText: { ...typography.caption, fontWeight: '600' },
});
