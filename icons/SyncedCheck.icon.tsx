import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export const SyncedCheckIcon = ({ width, height, color, ...props }: SvgProps) => (
  <Svg width={width || 18} height={height || 18} viewBox="0 0 24 24" fill="none" {...props}>
    <Circle cx={12} cy={12} r={10} fill={color || '#FFFFFF'} />
    <Path
      d="M7.5 12.25L10.45 15.2L16.7 8.9"
      stroke="#11336A"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
