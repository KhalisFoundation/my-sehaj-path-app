import React from 'react';
import { View } from 'react-native';
import { AppText as Text } from './AppText';
import { MemberAvatars, type AvatarMember } from './MemberAvatars';
import { CompletedPathCardStyles } from '@styles';
import { fontSizeIndexOf } from '@constants/FontSize';
import { formatPathCompletionDate } from '@utils/dateTime';
import { useAppSelector } from '../store/hooks';

const COMPLETED_CARD_DIMENSIONS = [
  { width: 126, height: 120 },
  { width: 132, height: 126 },
  { width: 138, height: 132 },
  { width: 158, height: 148 },
  { width: 158, height: 152 },
] as const;

export const completedCardDimensionsFor = (fontSizeIndex: number) =>
  COMPLETED_CARD_DIMENSIONS[
    Math.min(Math.max(fontSizeIndex, 0), COMPLETED_CARD_DIMENSIONS.length - 1)
  ];

interface Props {
  pathCompletionDate: string;
  pathName: string;
  members?: AvatarMember[];
}

export const SecondaryCard = ({ pathCompletionDate, pathName, members }: Props) => {
  const fontSizeIndex = useAppSelector((state) => fontSizeIndexOf(state.settings.fontSize));
  const dimensions = completedCardDimensionsFor(fontSizeIndex);
  const completionDate = formatPathCompletionDate(pathCompletionDate);

  return (
    <View style={[CompletedPathCardStyles.container, dimensions]}>
      <Text style={CompletedPathCardStyles.sehajText} numberOfLines={1} ellipsizeMode="tail">
        {pathName}
      </Text>
      <Text style={CompletedPathCardStyles.dateText} numberOfLines={2} ellipsizeMode="tail">
        {completionDate}
      </Text>
      <MemberAvatars members={members ?? []} />
    </View>
  );
};
