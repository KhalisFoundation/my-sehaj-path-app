import React from "react";
import { StyleProp, Text, TextStyle } from "react-native";
import { LabelStyles } from "../styles/LabelStyles";

interface Props {
  label: string;
  customLabelStyle?: StyleProp<TextStyle>;
}

export default function Label({ label, customLabelStyle }: Props) {
  return (
    <>
      <Text style={[LabelStyles.label, customLabelStyle]}>{label}</Text>
    </>
  );
}
