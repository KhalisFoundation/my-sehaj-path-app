import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

interface SyncedCheckIconProps extends SvgProps {
  size?: number;
}

/**
 * Completion badge for the sync status notice: a check inside a ring.
 *
 * Drawn on a 24px grid and scaled down, so it stays crisp at the 16–18px the
 * notice uses — unlike a "✓" glyph, whose weight and vertical alignment come
 * from whatever font happens to render it and never quite matches the spinner it
 * replaces.
 *
 * The ring is what makes it read as *finished* rather than as a decorative tick,
 * and it balances the circular `ActivityIndicator` shown moments earlier.
 */
export const SyncedCheckIcon = ({
  size = 17,
  color = '#FFFFFF',
  ...props
}: SyncedCheckIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={1.8} opacity={0.55} />
    <Path
      d="M7.75 12.4L10.6 15.25L16.4 9.25"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
