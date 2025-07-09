import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { SecondaryHeadingStyles } from '@styles';

interface Props {
  text: string;
  textStyles?: StyleProp<TextStyle>;
}

export const SecondaryHeading = ({ text, textStyles }: Props) => {
  return <Text style={[SecondaryHeadingStyles.heading, textStyles]}>{text}</Text>;
};
