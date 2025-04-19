import { View, Text } from "react-native";
import React from "react";
import Svg, { Path } from "react-native-svg";

export default function RightChevron() {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18L15 12L9 6"
        stroke={"#11336A"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
