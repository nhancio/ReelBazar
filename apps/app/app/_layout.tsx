import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppFrame } from '@/components/AppFrame';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { hydrateStorage } from '@/lib/storage';
import { firebaseEnabled } from '@/lib/firebase';

// Hold the native splash until storage is hydrated and auth has resolved, so the app never
// flashes a signed-out frame before restoring the session.
void SplashScreen.preventAutoHideAsync();

/**
 * Replaces the routing decisions the web app made inline in App.tsx: unauthenticated people
 * go to /auth, and anyone signed in without a username or interests is held on /onboarding.
 */
function useAuthRouting(hydrated: boolean) {
  const { firebaseUser, loading, isRegistered, guestMode, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const interests = user?.interests?.length ? user.interests : user?.productCategories || [];
  const needsOnboarding = Boolean(
    firebaseUser && !guestMode && user && (!user.username?.trim() || interests.length === 0)
  );

  const settled = hydrated && !loading;

  useEffect(() => {
    if (!settled) return;

    const first = segments[0];
    const onAuthScreen = first === 'auth';
    const onOnboarding = first === 'onboarding';
    const signedIn = Boolean(firebaseUser) || guestMode;

    if (!signedIn) {
      if (!onAuthScreen) router.replace('/auth');
      return;
    }
    if (needsOnboarding) {
      if (!onOnboarding) router.replace('/onboarding');
      return;
    }
    if (onAuthScreen || onOnboarding) {
      router.replace('/');
    }
  }, [settled, segments, firebaseUser, guestMode, needsOnboarding, router]);

  // Signed in but the Firestore profile hasn't landed yet — the web app showed a
  // "Setting up your profile..." screen for exactly this window.
  const settingUpProfile = Boolean(firebaseUser) && !isRegistered && !guestMode;

  return { settled, settingUpProfile };
}

function RootNavigator({ hydrated }: { hydrated: boolean }) {
  const { palette, theme } = useTheme();
  const { settled, settingUpProfile } = useAuthRouting(hydrated);

  useEffect(() => {
    if (settled) void SplashScreen.hideAsync().catch(() => {});
  }, [settled]);

  if (!settled) {
    return (
      <View style={[styles.fill, { backgroundColor: palette.background }]}>
        <LoadingSpinner size="lg" label="Loading Rava..." fullscreen />
      </View>
    );
  }

  if (settingUpProfile) {
    return (
      <View style={[styles.fill, { backgroundColor: palette.background }]}>
        <LoadingSpinner size="lg" label="Setting up your profile..." fullscreen />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.surface },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="orders/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="orders/[orderId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reel/[reelId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/[userId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="legal" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="blocked" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [hydrated, setHydrated] = useState(false);

  // Must complete before AuthProvider mounts: its useState initialisers read the store
  // synchronously, so an un-hydrated store would boot every session signed-out.
  useEffect(() => {
    void hydrateStorage().then(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!firebaseEnabled) {
      console.warn(
        '[rava] Firebase is not configured. Copy apps/app/.env.example to apps/app/.env and ' +
          'fill in the EXPO_PUBLIC_FIREBASE_* values, then restart with `npm run start:fresh`.'
      );
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <AppFrame>
              {hydrated ? (
                <AuthProvider>
                  <ToastProvider>
                    <RootNavigator hydrated={hydrated} />
                  </ToastProvider>
                </AuthProvider>
              ) : (
                <LoadingSpinner size="lg" fullscreen />
              )}
            </AppFrame>
          </ErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
