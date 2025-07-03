import React from 'react';
import { Animated, Text } from 'react-native';
import { NavContent } from '@components';
import { SaveIcon } from '@icons';
import { MessageStyles } from '@styles/MessageStyles';

interface Props {
  message: string;
  fadeAnim: Animated.Value;
}

export const Message = ({ message, fadeAnim }: Props) => {
  return (
    <>
      <Animated.View style={{ ...MessageStyles.saveContainer, opacity: fadeAnim }}>
        <NavContent navIcon={<SaveIcon />} />
        <Text style={MessageStyles.saveText} allowFontScaling={false}>
          {message}
        </Text>
      </Animated.View>
    </>
  );
};
