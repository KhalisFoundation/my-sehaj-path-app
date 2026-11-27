import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export const ProgressIcon = (props: SvgProps) => {
  return (
    <Svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3V6M18.366 5.634L16.246 7.754M21 12H18M18.366 18.366L16.246 16.246M12 21V18M5.634 18.366L7.754 16.246M3 12H6M5.634 5.634L7.754 7.754"
        stroke={props.color || '#11336A'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
};
