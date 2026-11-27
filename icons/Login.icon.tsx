import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export const LoginIcon = (props: SvgProps) => {
  return (
    <Svg width={props.width || 18} height={props.height || 18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M10.122 15.75H4.875C4.04625 15.75 3.375 14.8868 3.375 13.8218V4.1775C3.375 3.11325 4.04625 2.25 4.875 2.25H10.125"
        stroke={props.color || '#11336A'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <Path
        d="M9.75 11.625L7.125 9L9.75 6.375M14.625 8.997H7.125"
        stroke={props.color || '#11336A'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
};
