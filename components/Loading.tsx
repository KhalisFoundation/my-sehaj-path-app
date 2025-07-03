import { View, Text } from 'react-native';
import React from 'react';
import { PathScreenStyles } from '@styles/PathScreenStyles';

interface Props {
  alertIndicator: React.ReactNode;
  alertText: string;
}
export const Loading = ({ alertIndicator, alertText }: Props) => {
  return (
    <View style={PathScreenStyles.alertContainer}>
      {alertIndicator}
      <Text style={PathScreenStyles.alertText}>{alertText}</Text>
    </View>
  );
};
