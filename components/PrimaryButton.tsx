import React from 'react';
import { TouchableOpacity } from 'react-native';
import { AppText as Text } from './AppText';
import LinearGradient from 'react-native-linear-gradient';
import { PrimaryButtonStyles } from '@styles';
import { UIConstants } from '@constants/UIConstants';

interface Props {
  buttonTitle: string;
  onPress: () => void;
}

export const PrimaryButton = ({ buttonTitle, onPress }: Props) => {
  return (
    <LinearGradient
      colors={UIConstants.PRIMARY_BUTTON_GRADIENT_COLORS}
      start={{ x: 0.1, y: 0.1 }}
      end={{ x: 1, y: 0 }}
      style={PrimaryButtonStyles.container}
    >
      <TouchableOpacity
        onPress={onPress}
        style={PrimaryButtonStyles.button}
        accessibilityLabel={buttonTitle}
        accessibilityRole="button"
        accessibilityHint={`Tap to ${buttonTitle.toLowerCase()}`}
      >
        <Text style={PrimaryButtonStyles.text}>{buttonTitle}</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
};
