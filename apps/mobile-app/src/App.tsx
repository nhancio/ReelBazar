import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { AuthNavigator } from './navigation/AuthNavigator';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { MainTabs } from './navigation/MainTabs';
import { AuthContext } from './context/AuthContext';

const API_BASE_URL = 'http://localhost:4000/api';

export default function App() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [appUser, setAppUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setToken(idToken);
        try {
          const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            setAppUser(data.user);
          }
        } catch {}
      } else {
        setToken(null);
        setAppUser(null);
      }
      setLoading(false);
    });
    return subscriber;
  }, []);

  const register = async (data: any) => {
    if (!user || !token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...data, firebaseUid: user.uid, email: user.email }),
    });
    if (!res.ok) throw new Error('Registration failed');
    const result = await res.json();
    setAppUser(result.user);
  };

  const signOut = async () => {
    await auth().signOut();
    setAppUser(null);
    setToken(null);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ec4899" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, appUser, token, register, signOut, apiUrl: API_BASE_URL }}>
      <SafeAreaProvider>
        <NavigationContainer>
          {!user ? (
            <AuthNavigator />
          ) : !appUser ? (
            <OnboardingScreen />
          ) : (
            <MainTabs />
          )}
        </NavigationContainer>
      </SafeAreaProvider>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
});
