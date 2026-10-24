import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/context/ThemeContext';

const CONTENT_STYLE_KEYS = new Set([
  'flexDirection',
  'flexWrap',
  'alignItems',
  'justifyContent',
  'gap',
  'rowGap',
  'columnGap',
  'padding',
  'paddingVertical',
  'paddingHorizontal',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'minHeight',
  'minWidth',
]);

function splitGlassStyle(style?: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const inner: Record<string, unknown> = {};
  const outer: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    (CONTENT_STYLE_KEYS.has(k) ? inner : outer)[k] = v;
  }
  return { inner: inner as ViewStyle, outer: outer as ViewStyle };
}

/**
 * Prefer Apple's native Liquid Glass material (iOS 26+) when the OS provides it;
 * every other target (Android, web, older iOS) falls back to the multi-layer
 * BlurView + specular sheen + Fresnel rim composite below.
 */
function detectLiquidGlass(): boolean {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

export const LIQUID_GLASS = detectLiquidGlass();

interface Props {
  children?: React.ReactNode;
  /** Blur strength, 0-100. iOS honours this closely; Android approximates. */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  /** Fills the parent instead of laying out inline — for tab-bar backgrounds. */
  absolute?: boolean;
  /** Corner radius (squircle continuous curve on iOS). */
  cornerRadius?: number;
  /** Stronger translucent glass body tint. */
  raised?: boolean;
  /** Native only: adds Apple's touch-reactive glass highlight (buttons, chips). */
  interactive?: boolean;
}

/**
 * Liquid Glass material primitive (ported from Aura+ Liquid Glass design system).
 *
 * Layers, bottom -> top:
 *   1. Native GlassView (iOS 26+) OR BlurView (systemUltraThinMaterial)
 *   2. Translucent frost fill (palette.glassFill / palette.glassFillStrong)
 *   3. Broad diagonal specular sheen across upper face
 *   4. Tight corner hot-spot catch-light
 *   5. Subtle rose-pink prismatic rim highlight
 *   6. Fresnel-style top & bottom rim hairlines
 */
export function GlassSurface({
  children,
  intensity = 65,
  style,
  absolute = false,
  cornerRadius = 26,
  raised = false,
  interactive = false,
}: Props) {
  const { palette, theme } = useTheme();
  const isLight = theme === 'light';
  const { inner, outer } = splitGlassStyle(style);
  const resolvedRadius =
    typeof (outer as ViewStyle).borderRadius === 'number'
      ? ((outer as ViewStyle).borderRadius as number)
      : cornerRadius;

  const content = children ? (
    <View style={[styles.content, inner]}>{children}</View>
  ) : null;

  if (LIQUID_GLASS) {
    return (
      <View
        style={[
          absolute && StyleSheet.absoluteFill,
          { borderRadius: resolvedRadius, borderCurve: 'continuous' },
          outer,
        ]}
      >
        <GlassView
          glassEffectStyle="regular"
          isInteractive={interactive}
          tintColor={raised ? palette.glassFillStrong : palette.glassFill}
          colorScheme={isLight ? 'light' : 'dark'}
          style={[
            absolute && StyleSheet.absoluteFill,
            styles.glassNative,
            { borderRadius: resolvedRadius },
          ]}
        >
          {content}
        </GlassView>
      </View>
    );
  }

  return (
    <View
      style={[
        absolute && StyleSheet.absoluteFill,
        styles.clip,
        {
          borderRadius: resolvedRadius,
          borderCurve: 'continuous',
          borderColor: palette.glassBorder,
        },
        outer,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={
          Platform.OS === 'ios'
            ? isLight
              ? 'systemUltraThinMaterialLight'
              : 'systemUltraThinMaterialDark'
            : isLight
              ? 'light'
              : 'dark'
        }
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: raised ? palette.glassFillStrong : palette.glassFill },
        ]}
        pointerEvents="none"
      />
      {/* Broad diagonal sheen — ambient light wash across the upper face */}
      <LinearGradient
        colors={[palette.glassSheen, 'transparent']}
        locations={[0, 0.5]}
        style={[StyleSheet.absoluteFill, { opacity: 0.16, pointerEvents: 'none' }]}
      />
      {/* Tight corner hot-spot — crisp specular catch-light, Liquid Glass style */}
      <LinearGradient
        colors={[palette.glassSheen, 'transparent']}
        start={{ x: 0.08, y: 0.05 }}
        end={{ x: 0.62, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.28, pointerEvents: 'none' }]}
      />
      {/* Fresnel-style rim: bright hairline along the lit top edge */}
      <View
        style={[
          styles.glassRimTop,
          {
            backgroundColor: palette.glassEdge,
            borderTopLeftRadius: resolvedRadius,
            borderTopRightRadius: resolvedRadius,
          },
        ]}
        pointerEvents="none"
      />
      {/* Faint grounding line along the bottom */}
      <View
        style={[
          styles.glassRimBottom,
          {
            backgroundColor: palette.glassEdgeSoft,
            borderBottomLeftRadius: resolvedRadius,
            borderBottomRightRadius: resolvedRadius,
          },
        ]}
        pointerEvents="none"
      />
      {content}
    </View>
  );
}

/**
 * Circular Liquid Glass icon button — used for floating header controls, close buttons,
 * and camera/action triggers.
 */
export function GlassIconButton({
  icon,
  onPress,
  label,
  size = 38,
  iconSize,
  color,
  disabled,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  size?: number;
  iconSize?: number;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') {
          void Haptics.selectionAsync().catch(() => {});
        }
        onPress();
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.9 },
        style,
      ]}
    >
      <GlassSurface
        interactive
        raised
        cornerRadius={size / 2}
        intensity={72}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Ionicons
          name={icon}
          size={iconSize ?? Math.round(size * 0.5)}
          color={color ?? palette.text}
        />
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassNative: {
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  clip: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  glassRimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
  },
  glassRimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  content: { flex: 1 },
});
