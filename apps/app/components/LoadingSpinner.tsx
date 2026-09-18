import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { spacing, typography } from '@/theme';

interface Props {
  size?: 'sm' | 'lg';
  /** Optional caption under the spinner. */
  label?: string;
  /** Fill the parent and centre, for full-screen loading states. */
  fullscreen?: boolean;
}

export function LoadingSpinner({ size = 'sm', label, fullscreen = false }: Props) {
  const { palette } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        fullscreen && { flex: 1, backgroundColor: palette.background },
      ]}
    >
      <ActivityIndicator size={size === 'lg' ? 'large' : 'small'} color={palette.accent} />
      {label ? (
        <Text style={[styles.label, { color: palette.textMuted }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  label: {
    ...typography.caption,
    marginTop: spacing.lg,
    fontWeight: '600',
  },
});
