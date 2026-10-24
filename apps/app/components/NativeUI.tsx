import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  Host,
  Picker,
  Switch as ExpoSwitch,
  Button as ExpoButton,
  type ButtonVariant,
  type PickerAppearance,
} from '@expo/ui';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';

export interface NativeChoiceOption<T extends string | number = string> {
  label: string;
  value: T;
}

/**
 * Native segmented picker backed by `@expo/ui/community/segmented-control`:
 * - iOS: SwiftUI `Picker` with `.pickerStyle(.segmented)`
 * - Android: Jetpack Compose Material 3 `SingleChoiceSegmentedButtonRow`
 * - Web: Accessible segmented control
 */
export function NativeSegmentedPicker<T extends string>({
  options,
  selectedValue,
  onValueChange,
  enabled = true,
  style,
  testID,
}: {
  options: readonly NativeChoiceOption<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { palette, theme } = useTheme();
  const labels = options.map((opt) => opt.label);
  const selectedIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === selectedValue)
  );

  return (
    <SegmentedControl
      values={labels}
      selectedIndex={selectedIndex}
      enabled={enabled}
      appearance={theme === 'light' ? 'light' : 'dark'}
      tintColor={palette.accent}
      style={[styles.segmented, style]}
      testID={testID}
      onChange={(event) => {
        const idx = event.nativeEvent.selectedSegmentIndex;
        const picked = options[idx];
        if (picked && picked.value !== selectedValue) {
          if (Platform.OS !== 'web') {
            void Haptics.selectionAsync().catch(() => {});
          }
          onValueChange(picked.value);
        }
      }}
    />
  );
}

/**
 * Native dropdown / wheel picker backed by `@expo/ui` universal `Host` + `Picker`:
 * - iOS: SwiftUI `Picker` (`.pickerStyle(.menu)` Liquid Glass popover or `.wheel`)
 * - Android: Jetpack Compose Material 3 `ExposedDropdownMenuBox`
 * - Web: Native `<select>` element
 */
export function NativeDropdownPicker<T extends string | number>({
  options,
  selectedValue,
  onValueChange,
  appearance = 'menu',
  enabled = true,
  style,
  testID,
}: {
  options: readonly NativeChoiceOption<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  appearance?: PickerAppearance;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { palette, theme } = useTheme();

  return (
    <Host
      matchContents={{ vertical: true }}
      colorScheme={theme === 'light' ? 'light' : 'dark'}
      seedColor={palette.accent}
      ignoreSafeArea="all"
      style={[styles.dropdownHost, style]}
    >
      <Picker<T>
        selectedValue={selectedValue}
        appearance={appearance}
        enabled={enabled}
        testID={testID}
        onValueChange={(next) => {
          if (Platform.OS !== 'web') {
            void Haptics.selectionAsync().catch(() => {});
          }
          onValueChange(next);
        }}
      >
        {options.map((opt) => (
          <Picker.Item
            key={String(opt.value)}
            label={opt.label}
            value={opt.value}
          />
        ))}
      </Picker>
    </Host>
  );
}

/**
 * Native toggle switch backed by `@expo/ui` universal `Host` + `Switch`:
 * - iOS: SwiftUI `Toggle`
 * - Android: Jetpack Compose Material 3 `Switch`
 * - Web: Native `<input type="checkbox" role="switch">`
 */
export function NativeSwitch({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { palette, theme } = useTheme();

  return (
    <Host
      matchContents
      colorScheme={theme === 'light' ? 'light' : 'dark'}
      seedColor={palette.accent}
      ignoreSafeArea="all"
      style={style}
    >
      <ExpoSwitch
        value={value}
        label={label}
        disabled={disabled}
        testID={testID}
        onValueChange={(next) => {
          if (Platform.OS !== 'web') {
            void Haptics.selectionAsync().catch(() => {});
          }
          onValueChange(next);
        }}
      />
    </Host>
  );
}

/**
 * Native popup / context menu backed by `@expo/ui/community/menu`:
 * - iOS: SwiftUI `Menu` / `ContextMenu` (Liquid Glass popover on iOS 26+)
 * - Android: Jetpack Compose Material 3 `DropdownMenu`
 */
export function NativeMenu({
  title,
  actions,
  onSelectAction,
  shouldOpenOnLongPress = false,
  style,
  children,
}: {
  title?: string;
  actions: MenuAction[];
  onSelectAction: (actionId: string) => void;
  shouldOpenOnLongPress?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { theme } = useTheme();

  if (Platform.OS === 'web') {
    return <View style={style}>{children}</View>;
  }

  return (
    <MenuView
      title={title}
      actions={actions}
      colorScheme={theme === 'light' ? 'light' : 'dark'}
      shouldOpenOnLongPress={shouldOpenOnLongPress}
      style={style}
      onPressAction={({ nativeEvent }) => {
        void Haptics.selectionAsync().catch(() => {});
        onSelectAction(nativeEvent.event);
      }}
    >
      {children}
    </MenuView>
  );
}

/**
 * Native toolkit button backed by `@expo/ui` universal `Host` + `Button`:
 * - iOS: SwiftUI `Button` (`.borderedProminent`, `.bordered`, `.plain`)
 * - Android: Jetpack Compose Material 3 `Button`, `OutlinedButton`, `TextButton`
 * - Web: Pressable button
 */
export function NativeActionButton({
  label,
  onPress,
  variant = 'filled',
  disabled = false,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { palette, theme } = useTheme();

  return (
    <Host
      matchContents
      colorScheme={theme === 'light' ? 'light' : 'dark'}
      seedColor={palette.accent}
      ignoreSafeArea="all"
      style={style}
    >
      <ExpoButton
        label={label}
        variant={variant}
        disabled={disabled}
        testID={testID}
        onPress={() => {
          if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
          onPress?.();
        }}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  segmented: {
    minHeight: 36,
    width: '100%',
  },
  dropdownHost: {
    minHeight: 40,
  },
});
