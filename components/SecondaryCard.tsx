import React from 'react';
import { View } from 'react-native';
import { AppText as Text } from './AppText';
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
