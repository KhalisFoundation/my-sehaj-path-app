import React from 'react';
import { Switch, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { SimpleText } from '@components';
import { recordError, trackEvent } from '@utils';
import { UIConstants } from '@constants';

interface SwitchSettingItemProps {
  settingKey: string;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => Promise<boolean>;
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
  const handleToggle = async (newValue: boolean) => {
    try {
      const saved = await onValueChange(newValue);
      if (!saved) {
        return;
      }
      trackEvent(
        analyticsCategory,
        'click',
        `changed ${settingKey} to ${newValue ? 'enabled' : 'disabled'}`
      );
    } catch (error) {
      recordError(error, `SwitchSettingItem: failed to change ${settingKey}`);
    }
  };

  return (
    <View style={containerStyle}>
      <SimpleText simpleText={label} simpleTextStyle={textStyle} />
      <Switch
        // Use the platform control directly. The RNE wrapper applies its themed
        // iOS tint during initial mount and a different native tint after a
        // toggle, making an already-enabled persisted setting look lighter
        // than the same setting after it is switched off and on.
        value={value}
        onValueChange={handleToggle}
        trackColor={{
          false: UIConstants.SWITCH_TRACK_COLOR_FALSE,
          true: UIConstants.SWITCH_TRACK_COLOR_TRUE,
        }}
        // iOS renders an inactive switch against a separate background layer.
        // Without this colour, the same off-state can look transparent on one
        // row and filled on another depending on the view beneath it.
        ios_backgroundColor={UIConstants.SWITCH_TRACK_COLOR_FALSE}
        thumbColor={
          value ? UIConstants.SWITCH_THUMB_COLOR_TRUE : UIConstants.SWITCH_THUMB_COLOR_FALSE
        }
        accessibilityLabel={`${label} setting`}
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${value ? 'disable' : 'enable'} ${label}`}
        accessibilityState={{ checked: value }}
        testID={`settings-switch-${settingKey}`}
      />
    </View>
  );
};
