import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export const GoToAngIcon = (props: SvgProps) => {
  return (
    <Svg
      width={props.width || 18}
      height={props.height || 18}
      viewBox="0 0 18 18"
      fill="none"
    >
      <Path
        d="M8.46976 3.69675L14.3033 9.53025M14.3033 9.53025H10.5908M14.3033 9.53025V5.81775M9.53026 14.3032L3.69751 8.46975M3.69751 8.46975V12.1822M3.69751 8.46975H7.41001"
        stroke={props.color || '#11336A'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
};
