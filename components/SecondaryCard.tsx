import React from 'react';
import { View } from 'react-native';
import { AppText as Text } from './AppText';
import { MemberAvatars, type AvatarMember } from './MemberAvatars';
import { CompletedPathCardStyles } from '@styles';

interface Props {
  pathCompletionDate: string;
  pathName: string;
  /** Everyone who read this path, when it was shared. */
  members?: AvatarMember[];
}

export const SecondaryCard = ({ pathCompletionDate, pathName, members }: Props) => {
  return (
    <View style={CompletedPathCardStyles.container}>
      <Text style={CompletedPathCardStyles.sehajText}>{pathName}</Text>
      <Text style={CompletedPathCardStyles.dateText}>{pathCompletionDate}</Text>
      <MemberAvatars members={members ?? []} />
    </View>
  );
};
