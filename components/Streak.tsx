import { View } from 'react-native';
import React from 'react';
import { StreakStyles } from '@styles';

interface Props {
  value: number;
}

export const Streak = ({ value }: Props) => {
  return (
    <View
      style={{
        ...StreakStyles.streakContainer,
        opacity: value <= 0 ? 0.2 : value <= 5 && value > 0 ? 0.5 : 1,
      }}
    />
  );
};
