import React from "react";
import { Text, StyleProp, TextStyle } from "react-native";
import { HeadlineStyle } from "../styles/HeadlineStyles";

interface Props {
  headline: string;
  customHeadlineStyle?: StyleProp<TextStyle>;
}

export default function Headline({ headline, customHeadlineStyle }: Props) {
  return (
    <>
      <Text style={[HeadlineStyle.headline, customHeadlineStyle]}>
        {headline}
      </Text>
    </>
  );
}
