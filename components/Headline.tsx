import React from "react";
import { Text } from "react-native";
import { HeadlineStyle } from "../styles/HeadlineStyles";

interface Props {
  headline: string;
}

export default function Headline({ headline }: Props) {
  return (
    <>
      <Text style={HeadlineStyle.headline}>{headline}</Text>
    </>
  );
}
