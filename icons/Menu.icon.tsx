import React from 'react';
import Svg, { Line } from 'react-native-svg';
import { scaledIconSize, useAppIconScale } from './useAppIconScale';

interface MenuIconProps {
  color?: string;
}

export const MenuIcon = ({ color = '#fff' }: MenuIconProps) => {
  const scale = useAppIconScale();
  return (
    <Svg
      width={scaledIconSize(24, scale)}
      height={scaledIconSize(24, scale)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Line x1="4" y1="6" x2="16" y2="6" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="1" strokeLinecap="round" />
      <Line x1="4" y1="18" x2="14" y2="18" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
};
