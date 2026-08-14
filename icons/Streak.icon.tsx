import React from 'react';
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export const StreakIcon = (props: SvgProps) => {
  return (
    <Svg width={props.width || 18} height={props.height || 18} viewBox="0 0 18 18" fill="none">
      <Path
        d="M9.56098 2.679C9.60523 2.30175 9.16198 2.09625 8.93473 2.388L3.08323 9.89775C2.88973 10.1453 3.05473 10.5218 3.35623 10.5218H8.59723C8.81098 10.5218 8.97673 10.722 8.94973 10.9493L8.43973 15.3218C8.39473 15.6983 8.83723 15.9038 9.06523 15.612L14.9167 8.10225C15.1102 7.85475 14.9452 7.47825 14.6437 7.47825H9.40273C9.18898 7.47825 9.02323 7.278 9.05023 7.05075L9.56098 2.679Z"
        stroke={props.color || '#11336A'}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Svg>
  );
};
