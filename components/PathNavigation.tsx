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
      <TouchableOpacity
        style={PathNavigationStyles.arrowButton}
        onPress={() => handleLeftArrow(pathAng)}
        accessibilityLabel={`Previous ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to go to previous ang"
      >
        <NavContent
          navIcon={<LeftArrowIcon color="#fff" />}
          onPress={() => handleLeftArrow(pathAng)}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={PathNavigationStyles.angs}
        onPress={() => setIsAngsNavigationVisible(true)}
        accessibilityLabel={`Current ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to open angs navigation"
      >
        <NavContent text={pathPujabiAng} contentStyle={PathNavigationStyles.navText} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[PathNavigationStyles.arrowButton, PathNavigationStyles.arrowButtonRight]}
        onPress={() => handleRightArrow(pathAng)}
        accessibilityLabel={`Next ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to go to next ang"
      >
        <NavContent
          navIcon={<RightArrowIcon color="#fff" />}
          onPress={() => handleRightArrow(pathAng)}
        />
      </TouchableOpacity>
    </View>
  );
};
