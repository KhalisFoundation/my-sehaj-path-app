import { StyleProp, Text, TextStyle } from "react-native";
import React from "react";
import { SecondaryHeadingStyles } from "../styles/SecondaryHeadingStyles";

interface Props {
  text: string;
  textStyles?: StyleProp<TextStyle>;
}

export default function SecondaryHeading({ text, textStyles }: Props) {
  return (
    <>
      <Text style={[SecondaryHeadingStyles.heading, textStyles]}>{text}</Text>
    </>
  );
}
