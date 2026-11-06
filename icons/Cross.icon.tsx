import React from 'react';
import { Svg, Path } from 'react-native-svg';
import { UIConstants } from '@constants/UIConstants';
import { scaledIconSize, useAppIconScale } from './useAppIconScale';

interface CrossIconProps {
  /** Base size before the app's shared icon-scale is applied. */
  baseSize?: number;
}

export const CrossIcon = ({ baseSize = 20 }: CrossIconProps) => {
  const scale = useAppIconScale();
  return (
    <Svg
      width={scaledIconSize(baseSize, scale)}
      height={scaledIconSize(baseSize, scale)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d="M5 5L19 19M19 5L5 19"
        stroke={UIConstants.PRIMARY_COLOR}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
};
