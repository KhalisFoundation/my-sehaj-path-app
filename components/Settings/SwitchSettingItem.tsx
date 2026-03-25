import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Switch } from '@rneui/themed';
import { SimpleText } from '@components';
import { showErrorAlert, trackEvent } from '@utils';
import { UIConstants } from '@constants';

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
  containerStyle?: any;
  textStyle?: any;
  
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
      
      // Save to storage
      await saveFn(newValue);
      
      // Track analytics only after successful save
      trackEvent(
        analyticsCategory,
        'click',
        `changed ${settingKey} to ${newValue ? 'enabled' : 'disabled'}`
      );
      
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
          false: UIConstants.SWITCH_TRACK_COLOR_FALSE,
          true: UIConstants.SWITCH_TRACK_COLOR_TRUE,
        }}
        thumbColor={value ? UIConstants.SWITCH_THUMB_COLOR_TRUE : UIConstants.SWITCH_THUMB_COLOR_FALSE}
        accessibilityLabel={`${label} setting`}
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${value ? 'disable' : 'enable'} ${label}`}
        accessibilityState={{ checked: value }}
      />
    </View>
  );
};
