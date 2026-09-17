import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export const CalendarIcon = (props: SvgProps) => {
  return (
    <Svg
      width={props.width || 21}
      height={props.height || 21}
      viewBox="0 0 21 21"
      fill="none"
      {...props}
    >
      <Path
        stroke="#0D2346"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M14.25 2.75v-2m-9 2v-2M1 5.75h17.5M.75 7.794c0-2.115 0-3.173.436-3.981a3.896 3.896 0 0 1 1.748-1.651C3.79 1.75 4.91 1.75 7.15 1.75h5.2c2.24 0 3.36 0 4.216.412.753.362 1.364.94 1.748 1.65.436.81.436 1.868.436 3.983v4.912c0 2.115 0 3.173-.436 3.981a3.896 3.896 0 0 1-1.748 1.651c-.856.411-1.976.411-4.216.411h-5.2c-2.24 0-3.36 0-4.216-.412a3.896 3.896 0 0 1-1.748-1.65C.75 15.878.75 14.82.75 12.705V7.794Z"
      />
    </Svg>
  );
};
