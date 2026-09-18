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
import { OAuthProvider, signInWithCredential } from 'firebase/auth';
import Ionicons from '@expo/vector-icons/Ionicons';
import { APP_NAME } from '@reelbazaar/config';
import { auth } from '@/lib/firebase';
import { signInWithGoogle } from '@/lib/googleSignIn';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/Button';
import { spacing, typography } from '@/theme';

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
      // A cancelled sign-in is not an error worth shouting about.
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
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple sign-in returned no identity token.');
      const provider = new OAuthProvider('apple.com');
      await signInWithCredential(
        auth,
        provider.credential({ idToken: credential.identityToken })
      );
      await refreshUser();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== 'ERR_REQUEST_CANCELED') {
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
        { backgroundColor: palette.background, paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.brandBlock}>
        <Text style={[styles.brand, { color: palette.text }]}>{APP_NAME}</Text>
        <Text style={[styles.tagline, { color: palette.textMuted }]}>
          Shop the fashion you scroll.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label="Continue with Google"
          onPress={handleGoogle}
          loading={busy === 'google'}
          disabled={busy !== null}
          fullWidth
        />

        {/* iOS only — AppleAuthentication is unavailable elsewhere, and Apple's HIG forbids
            showing the button on platforms where it cannot work. */}
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
          onPress={() => enterGuestMode()}
          disabled={busy !== null}
          fullWidth
        />
      </View>

      {authError ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={16} color={palette.danger} />
          <Text style={[styles.errorText, { color: palette.danger }]}>{authError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  brandBlock: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  brand: { fontSize: 44, fontWeight: '700', letterSpacing: -1 },
  tagline: { ...typography.subtitle, textAlign: 'center' },
  actions: { gap: spacing.md },
  appleButton: { width: '100%', height: 48 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  errorText: { ...typography.caption },
});
