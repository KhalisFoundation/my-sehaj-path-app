import React from "react";
import { Text } from "react-native";
import { HeadlineStyle } from "@styles";

interface Props {
  headline: string;
}

export const Headline = ({ headline }: Props) => {
  return <Text style={HeadlineStyle.headline}>{headline}</Text>;
};
