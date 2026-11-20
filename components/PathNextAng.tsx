import React from 'react';
import { LeftLineIcon, RightArrowIcon, RightLineIcon } from '@icons';
import { View, TouchableOpacity } from 'react-native';
import { BackgroundImage } from './BackgroundImage';
import { AppText as Text } from './AppText';
import { PathNextAngStyles } from '@styles/PathNextAngStyles';
import { Constants } from '@constants';
import { AngImage } from '../assets/Images';

interface Props {
  pathAng: number;
  handleRightArrow: () => void;
}

export const PathNextAng = ({ pathAng, handleRightArrow }: Props) => {
  return (
    <>
      <View style={PathNextAngStyles.nextAngContainer}>
        <View style={PathNextAngStyles.container}>
          <LeftLineIcon />
          <BackgroundImage source={AngImage} style={PathNextAngStyles.imgBg}>
            <Text style={PathNextAngStyles.angText}>{pathAng}</Text>
          </BackgroundImage>
          <RightLineIcon />
        </View>
        <TouchableOpacity onPress={handleRightArrow} style={PathNextAngStyles.nextButtonContainer}>
          <View style={PathNextAngStyles.nextButton}>
            <RightArrowIcon color="#fff" />
          </View>
          <Text style={PathNextAngStyles.nextButtonText}>{Constants.GO_TO_NEXT_ANG}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};
