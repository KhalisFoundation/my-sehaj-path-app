import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { AppText as Text } from './AppText';
import { SecondaryButtonStyles } from '@styles';

interface Props {
  onPress: () => void;
  buttonText: string;
  buttonIcon: React.ReactNode;
  buttonStyle?: StyleProp<ViewStyle>;
  buttonIconStyle?: StyleProp<ViewStyle>;
}

export const SecondaryButton = ({
  onPress,
  buttonIcon,
  buttonText,
  buttonIconStyle,
  buttonStyle,
}: Props) => {
  return (
    <TouchableOpacity
      onPress={() => {
        onPress();
      }}
      accessibilityLabel={buttonText}
      accessibilityRole="button"
      accessibilityHint={`Tap to ${buttonText.toLowerCase()}`}
    >
      <LinearGradient
        colors={['rgba(17, 51, 106, 1)', 'rgba(13, 35, 70, 1)']}
        start={{ x: 0, y: 0.1 }}
        end={{ x: 1, y: 0 }}
        style={[SecondaryButtonStyles.secondaryButton, buttonStyle]}
      >
        <View style={buttonIconStyle}>{buttonIcon}</View>
        <Text style={SecondaryButtonStyles.secondaryButtonContent}>{buttonText}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};
