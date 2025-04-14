import { View } from "react-native";
import React from "react";
import { StreakStyles } from "../styles/StreakStyles";

interface Props {
  value: number;
}

export function Streak({ value }: Props) {
  return (
    <>
      <View
        style={{
          ...StreakStyles.streakContainer,
          opacity: value >= 0 ? 0.2 : value <= 5 && value > 0 ? 0.2 : 1,
        }}
      ></View>
    </>
  );
}
