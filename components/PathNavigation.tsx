import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { NavContent } from '@components';
import { LeftArrowIcon, RightArrowIcon } from '@icons';
import { PathNavigationStyles } from '@styles';
import { trackEvent } from '@utils';

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
  const handleLeftArrowPress = () => {
    trackEvent('PreviousAngsByTopNav', 'click', 'previous ang from top nav');
    handleLeftArrow(pathAng);
  };
  const handleRightArrowPress = () => {
    trackEvent('NextAngsByTopNav', 'click', 'next ang from top nav');
    handleRightArrow(pathAng);
  };
  const handleAngsNavigationPress = () => {
    trackEvent('AngsByAngsNavigation', 'click', 'opened angs navigation');
    setIsAngsNavigationVisible(true);
  };
  return (
    <View style={PathNavigationStyles.navContainer}>
      <TouchableOpacity
        style={PathNavigationStyles.arrowButton}
        onPress={handleLeftArrowPress}
        accessibilityLabel={`Previous ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to go to previous ang"
      >
        <NavContent navIcon={<LeftArrowIcon color="#fff" />} onPress={handleLeftArrowPress} />
      </TouchableOpacity>
      <TouchableOpacity
        style={PathNavigationStyles.angs}
        onPress={handleAngsNavigationPress}
        accessibilityLabel={`Current ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to open angs navigation"
      >
        <NavContent text={pathPujabiAng} contentStyle={PathNavigationStyles.navText} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[PathNavigationStyles.arrowButton, PathNavigationStyles.arrowButtonRight]}
        onPress={handleRightArrowPress}
        accessibilityLabel={`Next ang: ${pathPujabiAng}`}
        accessibilityRole="button"
        accessibilityHint="Tap to go to next ang"
      >
        <NavContent navIcon={<RightArrowIcon color="#fff" />} onPress={handleRightArrowPress} />
      </TouchableOpacity>
    </View>
  );
};
