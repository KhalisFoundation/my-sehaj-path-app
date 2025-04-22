import React from "react";
import { Text } from "react-native";
import { LabelStyles } from "@styles";

interface Props {
  label: string;
}

export const Label = ({ label }: Props) => {
  return (
    <>
      <Text style={LabelStyles.label}>{label}</Text>
    </>
  );
};
