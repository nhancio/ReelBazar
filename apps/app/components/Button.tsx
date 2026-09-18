import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { radius, spacing, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: Props) {
  const { palette } = useTheme();
  const inert = disabled || loading;

  const handlePress = () => {
    if (inert) return;
    // Haptics are a native-only API; calling it on web logs an unsupported warning.
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? palette.textOnAccent : palette.text}
        />
      ) : (
        <Text
          style={[
            styles.label,
            {
              color:
                variant === 'primary'
                  ? palette.textOnAccent
                  : variant === 'danger'
                    ? palette.danger
                    : palette.text,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'secondary' && {
          backgroundColor: palette.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.borderInteractive,
        },
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && {
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.danger,
        },
        inert && styles.inert,
        pressed && !inert && styles.pressed,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[...palette.accentGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: { width: '100%' },
  ghost: { backgroundColor: 'transparent' },
  inert: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    fontWeight: '700',
    textAlign: 'center',
  },
});
