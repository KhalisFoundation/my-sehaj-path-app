import React from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  type ModalProps,
} from 'react-native';
import { SimpleText } from '@components';
import { BlurView } from '@react-native-community/blur';
import { AppText } from '../AppText';
import { RightChevronIcon, CheckMarkIcon } from '@icons';
import { recordError, trackEvent } from '@utils';
import { SelectionSheetSettingItemStyles } from '@styles/SelectionSheetSettingItemStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelectionBottomSheet } from '@hooks';

// On iOS, React Native's Modal otherwise defaults to portrait-only, even if
// the app itself supports landscape.
const supportedOrientations: NonNullable<ModalProps['supportedOrientations']> = [
  'portrait',
  'landscape',
  'landscape-left',
  'landscape-right',
];

interface SelectionOption<T> {
  value: T;
  label: string;
}

interface SelectionSheetSettingItemProps<T> {
  /** Identifier used for the analytics label. */
  settingKey: string;

  // Display labels
  label: string;
  overlayTitle: string;

  // Options to select from
  options: SelectionOption<T>[];

  /** Current value (from the store) and its setter — see `useSetting`. */
  value: T;
  onValueChange: (value: T) => Promise<boolean>;

  // Optional configurations
  analyticsCategory?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;

  // Function to get display value from the selected option
  getDisplayValue: (value: T) => string;

  // Function to compare values for equality
  isEqual: (a: T, b: T) => boolean;

  // Show checkmark for selected item
  showCheckmark?: boolean;
}

/**
 * Controlled setting chooser. The value comes from the store and
 * saving/rollback is handled by `useSetting`.
 */
export const SelectionSheetSettingItem = <T,>({
  settingKey,
  label,
  overlayTitle,
  options,
  value: selectedValue,
  onValueChange,
  analyticsCategory = 'Settings',
  containerStyle,
  textStyle,
  getDisplayValue,
  isEqual,
  showCheckmark = true,
}: SelectionSheetSettingItemProps<T>) => {
  const insets = useSafeAreaInsets();
  const { isVisible, open, close, translateY, backdropOpacity, panHandlers } =
    useSelectionBottomSheet();

  const handleSelect = async (option: SelectionOption<T>) => {
    close();
    try {
      const saved = await onValueChange(option.value);
      if (!saved) {
        return;
      }
      trackEvent(analyticsCategory, 'click', `changed ${settingKey} to ${option.label}`);
    } catch (error) {
      recordError(error, `SelectionSheetSettingItem: failed to change ${settingKey}`);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={containerStyle}
        onPress={open}
        accessibilityLabel={`${label} setting, currently ${getDisplayValue(selectedValue)}`}
        accessibilityRole="button"
        accessibilityHint={`Tap to change ${label}`}
      >
        <SimpleText
          simpleText={label}
          simpleTextStyle={[textStyle, SelectionSheetSettingItemStyles.label]}
        />
        <View style={SelectionSheetSettingItemStyles.valueContainer}>
          <SimpleText simpleText={getDisplayValue(selectedValue)} simpleTextStyle={textStyle} />
          <RightChevronIcon />
        </View>
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={close}
        supportedOrientations={supportedOrientations}
        statusBarTranslucent
      >
        <View style={SelectionSheetSettingItemStyles.modalRoot}>
          <Pressable
            style={SelectionSheetSettingItemStyles.backdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={`Close ${overlayTitle}`}
          >
            <Animated.View
              pointerEvents="none"
              style={[SelectionSheetSettingItemStyles.backdropFill, { opacity: backdropOpacity }]}
            >
              <BlurView
                style={SelectionSheetSettingItemStyles.backdropBlur}
                blurType="light"
                blurAmount={4}
                reducedTransparencyFallbackColor="rgba(255, 255, 255, 0.72)"
              />
              <View style={SelectionSheetSettingItemStyles.backdropTint} />
            </Animated.View>
          </Pressable>
          <Animated.View
            style={[
              SelectionSheetSettingItemStyles.sheet,
              { paddingBottom: insets.bottom + 16, transform: [{ translateY }] },
            ]}
            accessibilityViewIsModal
          >
            <View {...panHandlers}>
              <View style={SelectionSheetSettingItemStyles.grabber} />
            </View>
            <View style={SelectionSheetSettingItemStyles.sheetHeader} {...panHandlers}>
              <AppText style={SelectionSheetSettingItemStyles.sheetTitle}>{overlayTitle}</AppText>
            </View>
            <ScrollView
              style={SelectionSheetSettingItemStyles.optionsScroll}
              showsVerticalScrollIndicator={false}
            >
              {options.map((option, index) => {
                const selected = isEqual(selectedValue, option.value);
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleSelect(option)}
                    style={[
                      SelectionSheetSettingItemStyles.option,
                      selected && SelectionSheetSettingItemStyles.selectedOption,
                      index < options.length - 1 && SelectionSheetSettingItemStyles.optionSeparator,
                    ]}
                    accessibilityLabel={`${label} option: ${option.label}`}
                    accessibilityRole="button"
                    accessibilityHint={`Tap to select ${option.label}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={SelectionSheetSettingItemStyles.optionContent}>
                      <AppText style={SelectionSheetSettingItemStyles.optionText}>
                        {option.label}
                      </AppText>
                      {showCheckmark && selected && <CheckMarkIcon />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};
