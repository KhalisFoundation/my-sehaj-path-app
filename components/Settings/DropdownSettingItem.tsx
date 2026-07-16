import React, { useState } from 'react';
import { TouchableOpacity, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { ListItem, Overlay } from '@rneui/themed';
import { NavContent, SimpleText } from '@components';
import { LeftArrowIcon, RightChevronIcon, CheckMarkIcon } from '@icons';
import { trackEvent } from '@utils';
import { DropdownSettingItemStyles } from '@styles/DropdownSettingItemStyles';

interface SelectionOption<T> {
  value: T;
  label: string;
}

interface DropdownSettingItemProps<T> {
  /** Identifier used for the analytics label. */
  settingKey: string;

  // Display labels
  label: string;
  overlayTitle: string;

  // Options to select from
  options: SelectionOption<T>[];

  /** Current value (from the store) and its setter — see `useSetting`. */
  value: T;
  onValueChange: (value: T) => void;

  // Optional configurations
  analyticsCategory?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  overlayHeaderStyle?: StyleProp<ViewStyle>;
  overlayTextContainerStyle?: StyleProp<ViewStyle>;
  overlayTextStyle?: StyleProp<TextStyle>;
  overlayContainerStyle?: StyleProp<ViewStyle>;
  overlayContentStyle?: StyleProp<ViewStyle>;

  // Function to get display value from the selected option
  getDisplayValue: (value: T) => string;

  // Function to compare values for equality
  isEqual: (a: T, b: T) => boolean;

  // Show checkmark for selected item
  showCheckmark?: boolean;
}

/**
 * Controlled dropdown. The value comes from the store and saving/rollback is
 * handled by `useSetting`, so this component only owns overlay visibility.
 */
export const DropdownSettingItem = <T,>({
  settingKey,
  label,
  overlayTitle,
  options,
  value: selectedValue,
  onValueChange,
  analyticsCategory = 'Settings',
  containerStyle,
  textStyle,
  overlayHeaderStyle,
  overlayTextContainerStyle,
  overlayTextStyle,
  overlayContainerStyle,
  overlayContentStyle,
  getDisplayValue,
  isEqual,
  showCheckmark = true,
}: DropdownSettingItemProps<T>) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const handleToggle = () => setIsVisible((prev) => !prev);

  const handleSelect = (option: SelectionOption<T>) => {
    onValueChange(option.value);
    handleToggle();
    trackEvent(analyticsCategory, 'click', `changed ${settingKey} to ${option.label}`);
  };

  return (
    <>
      <TouchableOpacity
        style={containerStyle}
        onPress={handleToggle}
        accessibilityLabel={`${label} setting, currently ${getDisplayValue(selectedValue)}`}
        accessibilityRole="button"
        accessibilityHint={`Tap to change ${label}`}
      >
        <SimpleText simpleText={label} simpleTextStyle={textStyle} />
        <View style={DropdownSettingItemStyles.valueContainer}>
          <SimpleText simpleText={getDisplayValue(selectedValue)} simpleTextStyle={textStyle} />
          <RightChevronIcon />
        </View>
      </TouchableOpacity>

      <Overlay
        isVisible={isVisible}
        onBackdropPress={handleToggle}
        overlayStyle={overlayContainerStyle}
      >
        <View>
          <View style={overlayHeaderStyle}>
            <NavContent navIcon={<LeftArrowIcon />} onPress={handleToggle} />
            <NavContent text={overlayTitle} />
          </View>
          <View style={overlayContentStyle}>
            {options.map((option, index) => (
              <ListItem
                key={index}
                onPress={() => handleSelect(option)}
                accessibilityLabel={`${label} option: ${option.label}`}
                accessibilityRole="button"
                accessibilityHint={`Tap to select ${option.label}`}
                accessibilityState={{ selected: isEqual(selectedValue, option.value) }}
              >
                <ListItem.Content style={overlayTextContainerStyle}>
                  <ListItem.Title style={overlayTextStyle}>{option.label}</ListItem.Title>
                  {showCheckmark && isEqual(selectedValue, option.value) && <CheckMarkIcon />}
                </ListItem.Content>
              </ListItem>
            ))}
          </View>
        </View>
      </Overlay>
    </>
  );
};
