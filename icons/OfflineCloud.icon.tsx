import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

/** Cloud connection is unavailable; used only by the sync-paused notice. */
export const OfflineCloudIcon = ({ width, height, color, ...props }: SvgProps) => (
  <Svg width={width || 21} height={height || 21} viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M7.1 18H17A3.5 3.5 0 0 0 17.8 11a5.9 5.9 0 0 0-11.3 1.4A2.9 2.9 0 0 0 7.1 18Z"
      stroke={color || '#FFFFFF'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M3.5 3.5L20.5 20.5"
      stroke={color || '#FFFFFF'}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);
