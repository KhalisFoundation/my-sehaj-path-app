import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { NavContent } from './NavContent';
import { LeftArrowIcon, RightArrowIcon } from '../icons';
import { PathNavigationStyles } from '@styles/PathNavigationStyles';

interface PathNavigationProps {
  pathPujabiAng: string;
  pathContent: any;
  handleLeftArrow: (pageNo: number) => void;
  handleRightArrow: (pageNo: number) => void;
  setIsAngsNavigationVisible: (isVisible: boolean) => void;
}

export const PathNavigation = ({
  pathPujabiAng,
  pathContent,
  handleLeftArrow,
  handleRightArrow,
  setIsAngsNavigationVisible,
}: PathNavigationProps) => {
  return (
    <View style={PathNavigationStyles.navContainer}>
      <TouchableOpacity
        onPress={() => {
          handleLeftArrow(pathContent?.source?.pageNo);
        }}
        accessibilityLabel="Previous ang"
        accessibilityRole="button"
        accessibilityHint="Tap to go to previous ang"
      >
        <NavContent navIcon={<LeftArrowIcon />} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setIsAngsNavigationVisible(true)}
        accessibilityLabel={`Current ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to open angs navigation"
      >
        <NavContent text={pathPujabiAng} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          handleRightArrow(pathContent?.source?.pageNo);
        }}
        accessibilityLabel="Next ang"
        accessibilityRole="button"
        accessibilityHint="Tap to go to next ang"
      >
        <NavContent navIcon={<RightArrowIcon />} />
      </TouchableOpacity>
    </View>
  );
};
