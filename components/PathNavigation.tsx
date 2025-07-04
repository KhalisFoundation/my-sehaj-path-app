import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { NavContent } from '@components';
import { LeftArrowIcon, RightArrowIcon } from '@icons';
import { PathNavigationStyles } from '@styles';

interface PathNavigationProps {
  pathPujabiAng: string;
  pathAng: number;
  handleLeftArrow: (pageNo: number) => void;
  handleRightArrow: (pageNo: number) => void;
  setIsAngsNavigationVisible: (isVisible: boolean) => void;
}

export const PathNavigation = ({
  pathPujabiAng,
  pathAng,
  handleLeftArrow,
  handleRightArrow,
  setIsAngsNavigationVisible,
}: PathNavigationProps) => {
  return (
    <View style={PathNavigationStyles.navContainer}>
      <NavContent navIcon={<LeftArrowIcon />} onPress={() => handleLeftArrow(pathAng)} />
      <TouchableOpacity
        onPress={() => setIsAngsNavigationVisible(true)}
        accessibilityLabel={`Current ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to open angs navigation"
      >
        <NavContent text={pathPujabiAng} />
      </TouchableOpacity>
      <NavContent navIcon={<RightArrowIcon />} onPress={() => handleRightArrow(pathAng)} />
    </View>
  );
};
