import React from 'react';
import { View, Text } from 'react-native';
import { CompletedPathCardStyles } from '@styles';

interface Props {
  pathCompletionDate: string;
  pathName: string;
}

export const SecondaryCard = ({ pathCompletionDate, pathName }: Props) => {
  return (
    <View style={CompletedPathCardStyles.container}>
      <Text style={CompletedPathCardStyles.sehajText}>{pathName}</Text>
      <Text style={CompletedPathCardStyles.dateText}>{pathCompletionDate}</Text>
    </View>
  );
};
