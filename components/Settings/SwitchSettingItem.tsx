import React from 'react';
import { View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Switch } from '@rneui/themed';
import { SimpleText } from '@components';
import { trackEvent } from '@utils';
import { UIConstants } from '@constants';

interface SwitchSettingItemProps {
  /** Identifier used for the analytics label. */
  settingKey: string;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  analyticsCategory?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Controlled switch. The value comes from the store and saving/rollback is
 * handled by `useSetting`, so this component holds no state and needs no
 * storage functions, default value, or error-message props.
 */
export const SwitchSettingItem = ({
  settingKey,
  label,
  value,
  onValueChange,
  analyticsCategory = 'Settings',
  containerStyle,
  textStyle,
}: SwitchSettingItemProps) => {
  const handleToggle = (newValue: boolean) => {
    onValueChange(newValue);
    trackEvent(
      analyticsCategory,
      'click',
      `changed ${settingKey} to ${newValue ? 'enabled' : 'disabled'}`
    );
  };

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
        thumbColor={
          value ? UIConstants.SWITCH_THUMB_COLOR_TRUE : UIConstants.SWITCH_THUMB_COLOR_FALSE
        }
        accessibilityLabel={`${label} setting`}
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${value ? 'disable' : 'enable'} ${label}`}
        accessibilityState={{ checked: value }}
      />
    </View>
  );
};
