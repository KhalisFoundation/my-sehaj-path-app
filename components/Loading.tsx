import React from 'react';
import { View, Text } from 'react-native';
import { LoadingStyles } from '@styles';

interface Props {
  alertIndicator: React.ReactNode;
  alertText: string;
}

export const Loading = ({ alertIndicator, alertText }: Props) => {
  return (
    <View style={LoadingStyles.alertContainer}>
      {alertIndicator}
      <Text style={LoadingStyles.alertText}>{alertText}</Text>
    </View>
  );
};
