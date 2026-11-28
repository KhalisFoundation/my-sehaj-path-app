import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, View, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { SimpleText } from '@components';
import { recordError, trackEvent } from '@utils';
import { SwitchSettingItemStyles } from '@styles';
import { fontSizeIndexOf } from '@constants/FontSize';
import { useAppSelector } from '../../store/hooks';

interface SwitchSettingItemProps {
  settingKey: string;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => Promise<boolean>;
  analyticsCategory?: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const SWITCH_SIZES = [
  {
    control: SwitchSettingItemStyles.controlExtraSmall,
    track: SwitchSettingItemStyles.trackExtraSmall,
    thumb: SwitchSettingItemStyles.thumbExtraSmall,
    travel: 24,
  },
  {
    control: SwitchSettingItemStyles.controlSmall,
    track: SwitchSettingItemStyles.trackSmall,
    thumb: SwitchSettingItemStyles.thumbSmall,
    travel: 26,
  },
  {
    control: SwitchSettingItemStyles.controlMedium,
    track: SwitchSettingItemStyles.trackMedium,
    thumb: SwitchSettingItemStyles.thumbMedium,
    travel: 28,
  },
  {
    control: SwitchSettingItemStyles.controlLarge,
    track: SwitchSettingItemStyles.trackLarge,
    thumb: SwitchSettingItemStyles.thumbLarge,
    travel: 30,
  },
  {
    control: SwitchSettingItemStyles.controlExtraLarge,
    track: SwitchSettingItemStyles.trackExtraLarge,
    thumb: SwitchSettingItemStyles.thumbExtraLarge,
    travel: 32,
  },
] as const;

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
  const fontSizeIndex = useAppSelector((state) => fontSizeIndexOf(state.settings.fontSize));
  const switchSize = SWITCH_SIZES[Math.min(Math.max(fontSizeIndex, 0), SWITCH_SIZES.length - 1)];
  const thumbOffset = useRef(new Animated.Value(value ? switchSize.travel : 0)).current;
  const thumbMotionStyle = useMemo(
    () => ({ transform: [{ translateX: thumbOffset }] }),
    [thumbOffset]
  );

  useEffect(() => {
    const animation = Animated.spring(thumbOffset, {
      toValue: value ? switchSize.travel : 0,
      tension: 180,
      friction: 18,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [switchSize.travel, thumbOffset, value]);

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
      <Pressable
        style={switchSize.control}
        onPress={() => handleToggle(!value)}
        accessibilityLabel={`${label} setting`}
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${value ? 'disable' : 'enable'} ${label}`}
        accessibilityState={{ checked: value }}
        testID={`settings-switch-${settingKey}`}
      >
        <Animated.View style={[switchSize.track, value && SwitchSettingItemStyles.trackEnabled]}>
          <Animated.View
            style={[
              switchSize.thumb,
              value && SwitchSettingItemStyles.thumbEnabled,
              thumbMotionStyle,
            ]}
          >
            <Animated.View style={SwitchSettingItemStyles.thumbBorder} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
};
