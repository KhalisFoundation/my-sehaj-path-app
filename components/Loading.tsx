import React from 'react';
import { View } from 'react-native';
import { AppText as Text } from './AppText';
import { LoadingStyles } from '@styles';

interface Props {
  alertIndicator: React.ReactNode;
  alertText: string;
}

export const Loading = ({ alertIndicator, alertText }: Props) => {
  return (
    <View style={LoadingStyles.alertContainer} pointerEvents="none">
      {alertIndicator}
      <Text style={LoadingStyles.alertText}>{alertText}</Text>
    </View>
  );
};
