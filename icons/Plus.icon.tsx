import React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

export const PlusIcon = (props: SvgProps) => {
  return (
    <>
      <Svg
        width={props.width || 14}
        height={props.height || 14}
        viewBox="0 0 14 14"
        fill="none"
        {...props}
      >
        <Path
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12.75 6.75h-6m0 0h-6m6 0v-6m0 6v6"
        />
      </Svg>
    </>
  );
};
