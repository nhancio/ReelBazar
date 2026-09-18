import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';
import { GlassSurface } from '@/components/GlassSurface';
import { TAB_BAR_HEIGHT } from '@/theme';

/**
 * Home / AI / Search / Profile, on a floating frosted-glass bar in the iOS idiom.
 *
 * Create is deliberately not a tab — with four destinations named, it moves to the "+" in the
 * Home header, which is also where Instagram and TikTok put it on iOS.
 */
export default function TabsLayout() {
  const { palette, theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const inactive = theme === 'light' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)';

  // The bar floats clear of the home indicator rather than sitting flush to the screen edge.
  const bottomInset = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.text,
        tabBarInactiveTintColor: inactive,
        tabBarShowLabel: false,
        // Transparent bar + blurred background view: the feed scrolls *under* the glass,
        // which is the whole point of the material. A solid bar would look pasted on.
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: bottomInset,
          height: TAB_BAR_HEIGHT,
          borderRadius: 26,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          paddingBottom: 0,
          // iOS draws its own shadow; Android's elevation is zeroed above so the glass edge
          // stays crisp instead of gaining a grey halo.
          ...(Platform.OS === 'ios'
            ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.18,
                shadowRadius: 20,
              }
            : null),
        },
        tabBarItemStyle: { height: TAB_BAR_HEIGHT },
        tabBarBackground: () => <GlassSurface absolute intensity={70} style={styles.glass} />,
        tabBarButton: ({ ref: _ref, ...props }) => (
          <Pressable
            {...props}
            onPress={(e) => {
              // Selection haptic on tab change — the iOS tab-bar feel.
              if (Platform.OS !== 'web') {
                void Haptics.selectionAsync().catch(() => {});
              }
              props.onPress?.(e);
            }}
          />
        ),
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home feed',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarAccessibilityLabel: 'Ask Rava',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'sparkles' : 'sparkles-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search reels',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? 'search' : 'search-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Your profile',
          tabBarIcon: ({ focused }) => (
            <View style={[styles.avatarTab, focused && { borderColor: palette.text }]}>
              <Avatar uri={user?.avatarUrl} name={user?.name} size={24} />
            </View>
          ),
        }}
      />

      {/* Reachable by push, not from the bar. */}
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="collaborations" options={{ href: null }} />
    </Tabs>
  );
}

/** Active tabs get a soft pill behind the glyph — the iOS 17 selected-tab treatment. */
function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  focused: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.iconWrap,
        focused && {
          backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)',
        },
      ]}
    >
      <Ionicons name={name} size={23} color={color as string} />
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: 26 },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTab: {
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 999,
    padding: 1,
  },
});
