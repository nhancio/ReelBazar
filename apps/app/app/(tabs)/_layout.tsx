import { useEffect, useRef, type ReactNode } from 'react';
import {
   Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { LIQUID_GLASS } from '@/components/GlassSurface';
import { deviceFrame } from '@/theme';

const TAB_ORDER = ['index', 'ai', 'search', 'profile'] as const;
type TabRouteName = (typeof TAB_ORDER)[number];

const SLIDE_SPRING = { damping: 18, stiffness: 260, mass: 0.72 };
const BAR_PAD = 6;
const SLOTS = 5; // Home, AI, [+ Create], Search, Profile

const TABS: Record<
  TabRouteName,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconActive: keyof typeof Ionicons.glyphMap;
  }
> = {
  index: { label: 'Home', icon: 'home-outline', iconActive: 'home' },
  ai: { label: 'AI', icon: 'sparkles-outline', iconActive: 'sparkles' },
  search: { label: 'Search', icon: 'search-outline', iconActive: 'search' },
  profile: { label: 'Profile', icon: 'person-outline', iconActive: 'person' },
};

/** Squash-and-spring the icon the moment its tab becomes active (ported from Aura+). */
function BounceOnFocus({ focused, children }: { focused: boolean; children: ReactNode }) {
  const pop = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (focused) {
      pop.value = withSequence(
        withTiming(1, { duration: 90 }),
        withSpring(0, { damping: 8, stiffness: 300, mass: 0.5 })
      );
    }
  }, [focused, pop]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: pop.value * 2 },
      { scaleX: 1 + pop.value * 0.14 },
      { scaleY: 1 - pop.value * 0.18 },
    ],
  }));

  return <Animated.View style={animStyle}>{children}</Animated.View>;
}

/**
 * Aura+ Liquid Glass floating capsule bottom navigation bar.
 *
 * Uses native `GlassContainer` + `GlassView` on iOS 26+ when `LIQUID_GLASS` is available,
 * and falls back to the multi-layered `systemUltraThinMaterial` BlurView + specular sheen +
 * rose-pink prismatic rim + Fresnel top edge + animated spring sliding glass pill.
 */
function RavaLiquidGlassTabBar({ state, navigation }: { state: any; navigation: any }) {
  const { palette, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isLight = theme === 'light';
  const isAndroid = Platform.OS === 'android';

  const bottomInset = isAndroid
    ? Math.max(insets.bottom, 14)
    : Math.max(insets.bottom, 10);

  const routes: Record<string, { key: string; name: string }> = {};
  state.routes.forEach((r: { key: string; name: string }) => {
    routes[r.name] = r;
  });

  const activeName = (state.routes[state.index]?.name ?? 'index') as string;
  const activeIndex = TAB_ORDER.indexOf(activeName as TabRouteName);
  // Slot 2 is the center Create action button, so tabs 2 & 3 shift by +1
  const activeSlot =
    activeIndex < 0 ? -1 : activeIndex >= 2 ? activeIndex + 1 : activeIndex;

  const slotW = useSharedValue(0);
  const pillX = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (activeSlot < 0 || slotW.value <= 0) return;
    pillX.value = withSpring(BAR_PAD + activeSlot * slotW.value, SLIDE_SPRING);
  }, [activeSlot, pillX, slotW]);

  const onBarLayout = (e: LayoutChangeEvent) => {
    const w = (e.nativeEvent.layout.width - BAR_PAD * 2) / SLOTS;
    if (w <= 0) return;
    slotW.value = w;
    if (activeSlot >= 0) {
      pillX.value = placed.current
        ? withSpring(BAR_PAD + activeSlot * w, SLIDE_SPRING)
        : BAR_PAD + activeSlot * w;
    }
    placed.current = true;
  };

  const slidePillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, slotW.value - 4),
    opacity: slotW.value > 0 ? 1 : 0,
    transform: [{ translateX: pillX.value + 2 }],
  }));

  const inactiveColor = isLight ? 'rgba(18, 14, 18, 0.52)' : 'rgba(255, 255, 255, 0.58)';
  const activeColor = palette.accent;

  const openTab = (name: TabRouteName) => {
    const route = routes[name];
    if (!route) return;
    const focused = activeName === name;
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync().catch(() => {});
    }
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const renderTab = (name: TabRouteName) => {
    const meta = TABS[name];
    const focused = activeName === name;
    const color = focused ? activeColor : inactiveColor;

    return (
      <Pressable
        key={name}
        onPress={() => openTab(name)}
        accessibilityRole="button"
        accessibilityLabel={meta.label}
        accessibilityState={{ selected: focused }}
        style={({ pressed }) => [
          styles.tab,
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <BounceOnFocus focused={focused}>
          {name === 'profile' && user?.avatarUrl ? (
            <View
              style={[
                styles.avatarTab,
                focused && { borderColor: palette.accent },
              ]}
            >
              <Avatar uri={user.avatarUrl} name={user.name} size={22} />
            </View>
          ) : (
            <Ionicons
              name={focused ? meta.iconActive : meta.icon}
              size={21}
              color={color}
            />
          )}
        </BounceOnFocus>
        <Text
          style={[
            styles.tabLabel,
            { color: focused ? (isLight ? palette.accent : '#ffffff') : inactiveColor },
            focused && styles.tabLabelActive,
          ]}
        >
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  const tabRow = (
    <>
      {activeSlot >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidePill,
            isLight
              ? styles.slidePillLight
              : [
                  styles.slidePillDark,
                  {
                    backgroundColor: 'rgba(255, 45, 120, 0.18)',
                    borderColor: 'rgba(255, 45, 120, 0.35)',
                  },
                ],
            slidePillStyle,
          ]}
        >
          {LIQUID_GLASS ? (
            <GlassView
              glassEffectStyle="clear"
              isInteractive
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </Animated.View>
      ) : null}

      <View style={styles.capsuleRow}>
        {TAB_ORDER.slice(0, 2).map(renderTab)}

        {/* Center Create Reel Action Button */}
        <View style={styles.actionSlot}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== 'web') {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              }
              router.push('/create');
            }}
            accessibilityRole="button"
            accessibilityLabel="Create Reel"
            style={({ pressed }) => [
              styles.actionFab,
              {
                shadowColor: palette.accent,
                borderColor: isLight
                  ? 'rgba(255, 255, 255, 0.92)'
                  : 'rgba(255, 255, 255, 0.38)',
              },
              pressed && { transform: [{ scale: 0.93 }] },
            ]}
          >
            <LinearGradient
              colors={[...palette.accentGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Specular cap across the top of the action orb */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.45)', 'transparent']}
              locations={[0, 0.5]}
              style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
            />
            <Ionicons name="add" size={24} color="#ffffff" />
          </Pressable>
        </View>

        {TAB_ORDER.slice(2).map(renderTab)}
      </View>
    </>
  );

  return (
    <View
      style={[styles.barWrap, { paddingBottom: bottomInset }]}
      pointerEvents="box-none"
    >
      <View style={styles.capsuleOuter}>
        {LIQUID_GLASS ? (
          <GlassContainer spacing={8} style={styles.capsuleNative}>
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              colorScheme={isLight ? 'light' : 'dark'}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.fillRow} onLayout={onBarLayout}>
              {tabRow}
            </View>
          </GlassContainer>
        ) : (
          <View
            style={[
              styles.capsule,
              {
                borderColor: isLight
                  ? 'rgba(255, 255, 255, 0.72)'
                  : palette.glassBorder,
              },
            ]}
            onLayout={onBarLayout}
          >
            <BlurView
              intensity={Platform.OS === 'ios' ? 82 : 68}
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
            {/* Translucent Liquid Glass frost body */}
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: isLight
                    ? 'rgba(255, 255, 255, 0.48)'
                    : 'rgba(18, 14, 22, 0.42)',
                },
              ]}
              pointerEvents="none"
            />
            {/* Top specular sheen wash */}
            <LinearGradient
              colors={
                isLight
                  ? ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.22)', 'transparent']
                  : ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.05)', 'transparent']
              }
              locations={[0, 0.34, 1]}
              style={[StyleSheet.absoluteFill, { opacity: 0.85, pointerEvents: 'none' }]}
            />
            {/* Rose-pink & champagne prismatic rim along top edge (zero blue) */}
            <LinearGradient
              colors={[
                'rgba(255, 45, 120, 0)',
                'rgba(255, 45, 120, 0.28)',
                'rgba(255, 160, 210, 0.24)',
                'rgba(255, 210, 170, 0.16)',
                'rgba(255, 45, 120, 0)',
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.prismRim}
              pointerEvents="none"
            />
            {/* Fresnel top highlight hairline */}
            <View
              style={[
                styles.capsuleEdge,
                isLight && styles.capsuleEdgeLight,
              ]}
              pointerEvents="none"
            />
            {tabRow}
          </View>
        )}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { palette, theme } = useTheme();
  const isLight = theme === 'light';

  // On iOS and Android, render real native system tab bars via NativeTabs:
  // - iOS: Apple UITabBarController (genuine iOS 26 Liquid Glass tab bar + SF Symbols + finger-drag selection morph)
  // - Android: Material 3 BottomNavigationView (react-native-screens Tabs.Host + Material Symbols + native ripple/indicator)
  if (Platform.OS !== 'web') {
    return (
      <NativeTabs
        tintColor={palette.accent}
        iconColor={{
          default: isLight ? 'rgba(18, 14, 18, 0.56)' : 'rgba(255, 255, 255, 0.62)',
          selected: palette.accent,
        }}
        labelStyle={{
          default: {
            fontSize: 11,
            fontWeight: '600',
            color: isLight ? 'rgba(18, 14, 18, 0.58)' : 'rgba(255, 255, 255, 0.62)',
          },
          selected: {
            fontSize: 11,
            fontWeight: '800',
            color: palette.accent,
          },
        }}
        backgroundColor={Platform.OS === 'android' ? palette.chromeStrong : undefined}
        indicatorColor={
          isLight ? 'rgba(225, 29, 98, 0.14)' : 'rgba(255, 45, 120, 0.22)'
        }
        rippleColor={
          isLight ? 'rgba(225, 29, 98, 0.18)' : 'rgba(255, 45, 120, 0.26)'
        }
        blurEffect={
          isLight ? 'systemUltraThinMaterialLight' : 'systemUltraThinMaterialDark'
        }
        minimizeBehavior="onScrollDown"
        labelVisibilityMode="labeled"
        tabBarRespectsIMEInsets
        screenListeners={{
          tabPress: () => {
            void Haptics.selectionAsync().catch(() => {});
          },
        }}
      >
        <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'house', selected: 'house.fill' }}
            md="home"
          />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="ai" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'sparkles', selected: 'sparkles' }}
            md="auto_awesome"
          />
          <NativeTabs.Trigger.Label>AI</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="create" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'plus.app', selected: 'plus.app.fill' }}
            md="add_box"
          />
          <NativeTabs.Trigger.Label>Create</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="search" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon
            sf="magnifyingglass"
            md="search"
          />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile" disableAutomaticContentInsets>
          <NativeTabs.Trigger.Icon
            sf={{ default: 'person', selected: 'person.fill' }}
            md="person"
          />
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="collaborations" hidden />
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
      }}
      tabBar={(props) => (
        <RavaLiquidGlassTabBar state={props.state} navigation={props.navigation} />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="ai" options={{ title: 'AI' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />

      {/* Reachable by push or center action button */}
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="collaborations" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 50,
    elevation: 20,
  },
  capsuleOuter: {
    width: '100%',
    maxWidth: deviceFrame.maxWidth - 24,
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.34,
          shadowRadius: 24,
        }
      : Platform.OS === 'web'
        ? ({ boxShadow: '0 12px 32px rgba(0, 0, 0, 0.36)' } as object)
        : { elevation: 16 }),
  },
  capsuleNative: {
    height: 64,
    borderRadius: 32,
    borderCurve: 'continuous',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fillRow: {
    flex: 1,
    justifyContent: 'center',
  },
  capsule: {
    height: 64,
    borderRadius: 32,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  prismRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.95,
  },
  capsuleEdge: {
    position: 'absolute',
    top: 0,
    left: '8%',
    right: '8%',
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
  },
  capsuleEdgeLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  slidePill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 0,
    borderRadius: 26,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  slidePillDark: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  slidePillLight: {
    backgroundColor: 'rgba(225, 29, 98, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(225, 29, 98, 0.24)',
  },
  capsuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: BAR_PAD,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '800',
  },
  actionSlot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  actionFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  avatarTab: {
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 999,
    padding: 1,
  },
});
