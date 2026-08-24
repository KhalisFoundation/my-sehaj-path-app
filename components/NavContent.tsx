import React from 'react';
import { View, TouchableOpacity, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { AppText as Text } from './AppText';
import { NavContentStyles } from '@styles';

interface Props {
  text?: string;
  navIcon?: React.ReactNode;
  onPress?: () => void;
  contentStyle?: StyleProp<TextStyle>;
  iconsStyle?: StyleProp<ViewStyle>;
}
export const NavContent = ({ text, navIcon, onPress, contentStyle, iconsStyle }: Props) => {
  return (
    <View style={NavContentStyles.container}>
      {text ? (
        <Text style={[NavContentStyles.navText, contentStyle]}>{text}</Text>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          accessibilityLabel="Navigation button"
          accessibilityRole="button"
          accessibilityHint="Tap to navigate"
          style={iconsStyle}
        >
          {navIcon}
        </TouchableOpacity>
      )}
    </View>
  );
};
