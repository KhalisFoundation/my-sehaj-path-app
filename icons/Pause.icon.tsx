import React from "react";
import Svg, { Rect } from "react-native-svg";

export const PauseIcon = () => {
  return (
    <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="4" width="2" height="16" rx="2" fill={"white"} />
      <Rect x="15" y="4" width="2" height="16" rx="2" fill={"white"} />
    </Svg>
  );
};
