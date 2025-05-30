import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';
import { NavContentStyles } from '@styles';

interface Props {
  text?: string;
  navIcon?: React.ReactNode;
  onPress?: () => void;
}
export const NavContent = ({ text, navIcon, onPress }: Props) => {
  return (
    <View style={NavContentStyles.container}>
      {text ? (
        <Text style={NavContentStyles.navText}>{text}</Text>
      ) : (
        <TouchableOpacity onPress={onPress}>{navIcon}</TouchableOpacity>
      )}
    </View>
  );
};
