import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { scaledIconSize, useAppIconScale } from './useAppIconScale';

export const RightChevronIcon = () => {
  const scale = useAppIconScale();
  return (
    <Svg
      width={scaledIconSize(21, scale)}
      height={scaledIconSize(21, scale)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d="M9 18L15 12L9 6"
        stroke={'#11336A'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
