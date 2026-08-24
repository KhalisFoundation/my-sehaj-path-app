import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { AppText as Text } from './AppText';
import type { TextRole } from '@constants/FontSize';
import { SecondaryHeadingStyles } from '@styles';

interface Props {
  text: string;
  textStyles?: StyleProp<TextStyle>;
  /** Which row of the typography table this heading belongs to. */
  variant?: TextRole;
}

export const SecondaryHeading = ({ text, textStyles, variant }: Props) => {
  return (
    <Text style={[SecondaryHeadingStyles.heading, textStyles]} variant={variant}>
      {text}
    </Text>
  );
};
