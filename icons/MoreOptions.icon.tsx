import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { scaledIconSize, useAppIconScale } from './useAppIconScale';

interface MoreOptionsIconProps {
  color?: string;
}

/** The three-dot "more actions" affordance. */
export const MoreOptionsIcon = ({ color = '#11336A' }: MoreOptionsIconProps) => {
  const scale = useAppIconScale();

  return (
    <Svg
      width={scaledIconSize(24, scale)}
      height={scaledIconSize(24, scale)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Circle cx="12" cy="5" r="1.8" fill={color} />
      <Circle cx="12" cy="12" r="1.8" fill={color} />
      <Circle cx="12" cy="19" r="1.8" fill={color} />
    </Svg>
  );
};
