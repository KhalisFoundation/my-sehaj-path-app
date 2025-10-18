import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, TextStyle } from 'react-native';
import { NavContentStyles } from '@styles';

interface Props {
  text?: string;
  navIcon?: React.ReactNode;
  onPress?: () => void;
  contentStyle?: StyleProp<TextStyle>;
}
export const NavContent = ({ text, navIcon, onPress, contentStyle }: Props) => {
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
        >
          {navIcon}
        </TouchableOpacity>
      )}
    </View>
  );
};
