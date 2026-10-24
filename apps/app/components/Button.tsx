import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { radius, shadows, spacing, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
}: Props) {
  const { palette } = useTheme();
  const inert = disabled || loading;

  const handlePress = () => {
    if (inert) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.();
  };

  const textColor =
    variant === 'primary'
      ? palette.textOnAccent
      : variant === 'danger'
        ? palette.danger
        : palette.text;

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={textColor} /> : null}
          <Text
            style={[
              styles.label,
              size === 'sm' && styles.labelSm,
              size === 'lg' && styles.labelLg,
              { color: textColor },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      android_ripple={
        inert
          ? undefined
          : {
              color:
                variant === 'primary'
                  ? 'rgba(255, 255, 255, 0.24)'
                  : 'rgba(255, 45, 120, 0.16)',
              foreground: true,
            }
      }
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.baseSm,
        size === 'lg' && styles.baseLg,
        fullWidth && styles.fullWidth,
        variant === 'primary' && shadows.glow,
        variant === 'secondary' && {
          backgroundColor: palette.cardElevated,
          borderWidth: 1,
          borderColor: palette.borderStrong,
        },
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && {
          backgroundColor: palette.dangerSoft,
          borderWidth: 1,
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
          end={{ x: 1, y: 1 }}
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
    borderCurve: 'continuous',
    paddingHorizontal: spacing.xl,
    minHeight: 50,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  baseSm: {
    minHeight: 38,
    paddingHorizontal: spacing.lg,
  },
  baseLg: {
    minHeight: 54,
    paddingHorizontal: spacing.xxl,
  },
  fullWidth: { width: '100%' },
  ghost: { backgroundColor: 'transparent' },
  inert: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  labelSm: {
    fontSize: 13,
  },
  labelLg: {
    fontSize: 16,
    fontWeight: '800',
  },
});
