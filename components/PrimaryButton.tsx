import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { PrimaryButtonStyles } from '@styles';

interface Props {
  buttonTitle: string;
  Icon: React.ReactNode;
  onPress: () => any;
}

export const PrimaryButton = ({ buttonTitle, Icon, onPress }: Props) => {
  return (
    <LinearGradient
      colors={['#11336A', '#0D2346']}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 1, y: 0 }}
      style={PrimaryButtonStyles.container}
    >
      <TouchableOpacity onPress={onPress} style={PrimaryButtonStyles.button}>
        <View>{Icon}</View>
        <Text style={PrimaryButtonStyles.text}>{buttonTitle}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};
