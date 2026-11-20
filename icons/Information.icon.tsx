import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
import { UIConstants } from '@constants/UIConstants';

/** Informational status mark used in non-destructive path-update dialogs. */
export const InformationIcon = ({
  width = 40,
  height = 40,
  color = UIConstants.STATUS_ERROR_COLOR,
  ...props
}: SvgProps) => (
  <Svg width={width} height={height} viewBox="0 0 48 48" fill="none" {...props}>
    <Circle cx="24" cy="24" r="18" stroke={color} strokeWidth="3" />
    <Circle cx="24" cy="15" r="2.25" fill={color} />
    <Path d="M24 22V34" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
  </Svg>
);
