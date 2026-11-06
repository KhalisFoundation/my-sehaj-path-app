import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { scaledIconSize, useAppIconScale } from './useAppIconScale';

export const CheckMarkIcon = () => {
  const scale = useAppIconScale();
  return (
    <Svg
      width={scaledIconSize(21, scale)}
      height={scaledIconSize(21, scale)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d="M20 6L9 17L4 12"
        stroke="#11336A"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
