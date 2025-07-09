import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { SimpleTextStyles } from '@styles';

interface Props {
  simpleText: string[] | React.ReactNode[] | string;
  simpleTextStyle?: StyleProp<TextStyle>;
}

export const SimpleText = ({ simpleText, simpleTextStyle }: Props) => {
  return (
    <Text style={[SimpleTextStyles.simpleText, simpleTextStyle]}>
      {typeof simpleText === 'string'
        ? simpleText
        : simpleText.map((text, index) => <React.Fragment key={index}>{text}</React.Fragment>)}
    </Text>
  );
};
