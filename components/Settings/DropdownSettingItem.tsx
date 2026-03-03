import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { ListItem, Overlay } from '@rneui/themed';
import { NavContent, SimpleText } from '@components';
import { LeftArrowIcon, RightChevronIcon, CheckMarkIcon } from '@icons';
import { showErrorAlert, trackEvent } from '@utils';
import { DropdownSettingItemStyles } from '@styles/DropdownSettingItemStyles';

interface SelectionOption<T> {
  value: T;
  label: string;
}

interface DropdownSettingItemProps<T> {
  // Unique identifier for this setting
  settingKey: string;
  
  // Display labels
  label: string;
  overlayTitle: string;
  
  // Options to select from
  options: SelectionOption<T>[];
  
  // Storage functions
  saveFn: (value: T) => Promise<void>;
  fetchFn: () => Promise<T>;
  
  // Error messages
  errorMessages: {
    loadError: string;
    saveError: string;
  };
  
  // Default value
  defaultValue: T;
  
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

export function DropdownSettingItem<T>({
  settingKey,
  label,
  overlayTitle,
  options,
  saveFn,
  fetchFn,
  errorMessages,
  defaultValue,
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
}: DropdownSettingItemProps<T>) {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [selectedValue, setSelectedValue] = useState<T>(defaultValue);

  const handleToggle = () => setIsVisible(prev => !prev);

  const handleSelect = async (option: SelectionOption<T>) => {
    try {
      setSelectedValue(option.value);
      
      handleToggle();
      
      // Save to storage
      await saveFn(option.value);
      
      // Track analytics only after successful save
      trackEvent(
        analyticsCategory,
        'click',
        `changed ${settingKey} to ${option.label}`
      );
    } catch (error) {
      // Revert on error
      showErrorAlert(errorMessages.saveError);
      setSelectedValue(selectedValue);
    }
  };

  useEffect(() => {
    const loadSetting = async () => {
      try {
        const savedValue = await fetchFn();
        setSelectedValue(savedValue ?? defaultValue);
      } catch (error) {
        showErrorAlert(errorMessages.loadError);
        setSelectedValue(defaultValue);
      }
    };
    loadSetting();
  }, [fetchFn, defaultValue]);

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
          <SimpleText
            simpleText={getDisplayValue(selectedValue)}
            simpleTextStyle={textStyle}
          />
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
                  <ListItem.Title style={overlayTextStyle}>
                    {option.label}
                  </ListItem.Title>
                  {showCheckmark && isEqual(selectedValue, option.value) && <CheckMarkIcon />}
                </ListItem.Content>
              </ListItem>
            ))}
          </View>
        </View>
      </Overlay>
    </>
  );
}
