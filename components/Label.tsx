import React from "react";
import { Text } from "react-native";
import { LabelStyles } from "../styles/LabelStyles";

interface Props {
  label: string;
}

export default function Label({ label }: Props) {
  return (
    <>
      <Text style={LabelStyles.label}>{label}</Text>
    </>
  );
}
