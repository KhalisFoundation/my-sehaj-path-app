import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
import { scaledIconSize, useAppIconScale } from './useAppIconScale';

/** Repeat control glyph used by the turn scheduling flow. */
export const RepeatIcon = (props: SvgProps) => {
  const scale = useAppIconScale();
  return (
    <Svg
      width={props.width ?? scaledIconSize(25, scale)}
      height={props.height ?? scaledIconSize(25, scale)}
      viewBox="0 0 24 24"
      fill="none"
      {...props}
    >
      <Path
        d="M17 1.5 20.5 5 17 8.5M3.5 8.5V7A2 2 0 0 1 5.5 5h15M7 22.5 3.5 19 7 15.5M20.5 15.5V17a2 2 0 0 1-2 2h-15"
        stroke="#11336A"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
