import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface ProgressIconProps {
  color?: string;
}

export const AllPathLogoIcon = ({ color = '#11336A' }: ProgressIconProps) => {
  return (
    <Svg width="14" height="15" viewBox="0 0 14 15" fill="none">
      <Path
        d="M2.34975 14.2502C1.46625 14.2502 0.75 13.5152 0.75 12.6077V6.00621C0.75 5.50746 0.97125 5.03496 1.35 4.72371L5.75025 1.11021C6.03139 0.877394 6.38497 0.75 6.75 0.75C7.11503 0.75 7.46861 0.877394 7.74975 1.11021L12.1492 4.72371C12.5287 5.03496 12.75 5.50746 12.75 6.00621V12.6077C12.75 13.5152 12.0338 14.2502 11.1503 14.2502H2.34975Z"
        stroke={color}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
};
