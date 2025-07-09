import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { ImportantTextStyles } from '@styles';

interface Props {
  importantText: string;
  importantTextStyles?: StyleProp<TextStyle>;
}

export const ImportantText = ({ importantText, importantTextStyles }: Props) => {
  return (
    <Text style={[ImportantTextStyles.importantText, importantTextStyles]}>{importantText}</Text>
  );
};
