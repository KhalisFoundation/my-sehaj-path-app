import React from 'react';
import Svg, { Circle } from 'react-native-svg';

interface MoreOptionsIconProps {
  color?: string;
}

/** The three-dot "more actions" affordance. */
export const MoreOptionsIcon = ({ color = '#11336A' }: MoreOptionsIconProps) => (
  <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="5" r="1.8" fill={color} />
    <Circle cx="12" cy="12" r="1.8" fill={color} />
    <Circle cx="12" cy="19" r="1.8" fill={color} />
  </Svg>
);
