import React from 'react';
import { LeftLineIcon, RightArrowIcon, RightLineIcon } from '@icons';
import { View, Text, TouchableOpacity, ImageBackground } from 'react-native';
import { PathNextAngStyles } from '@styles/PathNextAngStyles';
import { Constants } from '@constants';

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
          <ImageBackground
            source={require('../assets/Images/Ang.png')}
            style={PathNextAngStyles.imgBg}
          >
            <Text style={PathNextAngStyles.angText}>{pathAng}</Text>
          </ImageBackground>
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
