import React, { useState, useEffect } from 'react';
import { View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Switch } from '@rneui/themed';
import { SimpleText } from '@components';
import { showErrorAlert, trackEvent } from '@utils';

interface SwitchSettingItemProps {
  // Unique identifier for this setting
  settingKey: string;
  
  // Display label
  label: string;
  
  // Storage functions
  saveFn: (value: boolean) => Promise<void>;
  fetchFn: () => Promise<boolean>;
  
  // Error messages
  errorMessages: {
    loadError: string;
    saveError: string;
  };
  
  // Optional configurations
  defaultValue?: boolean;
  analyticsCategory?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  
  // Optional callback when value changes
  onValueChange?: (value: boolean) => void;
}

export const SwitchSettingItem = ({
  settingKey,
  label,
  saveFn,
  fetchFn,
  errorMessages,
  defaultValue = false,
  analyticsCategory = 'Settings',
  containerStyle,
  textStyle,
  onValueChange,
}: SwitchSettingItemProps) => {
  const [value, setValue] = useState<boolean>(defaultValue);

  const handleToggle = async (newValue: boolean) => {
    try {
      setValue(newValue);
      
      // Track analytics
      trackEvent(
        analyticsCategory,
        'click',
        `changed ${settingKey} to ${newValue ? 'enabled' : 'disabled'}`
      );
      
      // Save to storage
      await saveFn(newValue);
      
      // Call optional callback
      if (onValueChange) {
        onValueChange(newValue);
      }
    } catch (error) {
      // Revert on error
      showErrorAlert(errorMessages.saveError);
      setValue(!newValue);
    }
  };

  useEffect(() => {
    const loadSetting = async () => {
      try {
        const savedValue = await fetchFn();
        setValue(savedValue ?? defaultValue);
      } catch (error) {
        showErrorAlert(errorMessages.loadError);
        setValue(defaultValue);
      }
    };
    loadSetting();
  }, [fetchFn, defaultValue]);

  return (
    <View style={containerStyle}>
      <SimpleText simpleText={label} simpleTextStyle={textStyle} />
      <Switch
        value={value}
        onValueChange={handleToggle}
        trackColor={{
          false: 'rgb(194, 194, 194)',
          true: 'rgba(17, 51, 106, 0.46)',
        }}
        thumbColor={value ? 'rgb(17, 51, 106)' : 'rgb(142, 142, 142)'}
        accessibilityLabel={`${label} setting`}
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${value ? 'disable' : 'enable'} ${label}`}
        accessibilityState={{ checked: value }}
      />
    </View>
  );
};
