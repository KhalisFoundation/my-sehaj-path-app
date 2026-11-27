import React, { type ReactNode } from 'react';
import { TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { LeftArrowIcon } from '@icons';
import { UIConstants } from '@constants';

interface Props {
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  hitSlop?: number;
}

/** Shared back affordance with a consistent touch target across screens. */
export const BackButton = ({
  onPress,
  accessibilityLabel = 'Back',
  accessibilityHint = 'Tap to go back',
  color = UIConstants.PRIMARY_COLOR,
  style,
  children,
  hitSlop = 12,
}: Props) => (
  <TouchableOpacity
    onPress={onPress}
    style={style}
    hitSlop={hitSlop}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
  >
    <LeftArrowIcon color={color} />
    {children}
  </TouchableOpacity>
);
