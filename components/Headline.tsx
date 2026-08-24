import React from 'react';
import { AppText as Text } from './AppText';
import { HeadlineStyle } from '@styles';

interface Props {
  headline: string;
}

export const Headline = ({ headline }: Props) => {
  return <Text style={HeadlineStyle.headline}>{headline}</Text>;
};
