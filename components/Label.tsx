import React from 'react';
import { AppText as Text } from './AppText';
import { LabelStyles } from '@styles';

interface Props {
  label: string;
}

export const Label = ({ label }: Props) => {
  return <Text style={LabelStyles.label}>{label}</Text>;
};
