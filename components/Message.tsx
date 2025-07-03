import React from 'react';
import { NavContent } from './NavContent';
import { Animated, Text } from 'react-native';
import { PathScreenStyles } from '@styles/PathScreenStyles';
import { SaveIcon } from '@icons/Save.icon';
interface Props {
  message: string;
  fadeAnim: Animated.Value;
}
export const Message = ({ message, fadeAnim }: Props) => {
  return (
    <>
      <Animated.View style={{ ...PathScreenStyles.saveContainer, opacity: fadeAnim }}>
        <NavContent navIcon={<SaveIcon />} />
        <Text style={PathScreenStyles.saveText} allowFontScaling={false}>
          {message}
        </Text>
      </Animated.View>
    </>
  );
};
