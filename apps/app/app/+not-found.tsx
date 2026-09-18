import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { spacing, typography } from '@/theme';

export default function NotFoundScreen() {
  const { palette } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={[styles.wrap, { backgroundColor: palette.background }]}>
        <Text style={[styles.title, { color: palette.text }]}>This page doesn&apos;t exist.</Text>
        <Link href="/" style={[styles.link, { color: palette.accent }]}>
          Go to the feed
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { ...typography.heading },
  link: { ...typography.body, marginTop: spacing.lg, fontWeight: '600' },
});
