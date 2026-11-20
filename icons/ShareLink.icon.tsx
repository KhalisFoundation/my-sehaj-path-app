import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Link symbol used when sharing a Sehaj Path invitation. */
export const ShareLinkIcon = ({ color }: { color?: string }) => {
  return (
    <Svg width={18} height={18} viewBox="0 0 14 14" fill="none">
      <Path
        stroke={color || '#11336A'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.069}
        d="m9.987 7.304 2.711-2.714c.91-.91.89-2.406-.044-3.341s-2.429-.955-3.339-.045L6.193 4.33c-.91.91-.89 2.406.044 3.341M3.916 6.598l-2.71 2.714c-.911.91-.892 2.406.042 3.341s2.429.955 3.339.045l3.122-3.126m0-3.386c.936.935.956 2.431.045 3.34"
      />
    </Svg>
  );
};
