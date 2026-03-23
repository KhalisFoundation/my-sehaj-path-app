import React, { useCallback, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { NavContent } from '@components';
import { LeftArrowIcon, RightArrowIcon, MenuIcon } from '@icons';
import { PathNavigationStyles } from '@styles';
import { trackEvent } from '@utils';

interface PathNavigationProps {
  pathPujabiAng: string;
  pathAng: number;
  handleLeftArrow: (pageNo: number) => void;
  handleRightArrow: (pageNo: number) => void;
  setIsAngsNavigationVisible: (isVisible: boolean) => void;
  onMenuPress?: () => void;
}

const PathNavigationComponent = ({
  pathPujabiAng,
  pathAng,
  handleLeftArrow,
  handleRightArrow,
  setIsAngsNavigationVisible,
  onMenuPress,
}: PathNavigationProps) => {
  const handleLeftArrowPress = useCallback(() => {
    trackEvent('PreviousAngsByTopNav', 'click', 'previous ang from top nav');
    handleLeftArrow(pathAng);
  }, [handleLeftArrow, pathAng]);

  const handleRightArrowPress = useCallback(() => {
    trackEvent('NextAngsByTopNav', 'click', 'next ang from top nav');
    handleRightArrow(pathAng);
  }, [handleRightArrow, pathAng]);

  const handleAngsNavigationPress = useCallback(() => {
    trackEvent('AngsByAngsNavigation', 'click', 'opened angs navigation');
    setIsAngsNavigationVisible(true);
  }, [setIsAngsNavigationVisible]);

  const leftArrowIcon = useMemo(() => <LeftArrowIcon color="#fff" />, []);
  const rightArrowIcon = useMemo(() => <RightArrowIcon color="#fff" />, []);
  const menuIcon = useMemo(() => <MenuIcon color="#fff" />, []);

  const handleMenuPress = useCallback(() => {
    if (onMenuPress) {
      trackEvent('MenuPress', 'click', 'menu button pressed');
      onMenuPress();
    }
  }, [onMenuPress]);

  return (
    <View style={PathNavigationStyles.navContainer}>
      <TouchableOpacity
        style={PathNavigationStyles.menuButton}
        onPress={handleMenuPress}
        accessibilityLabel="Menu"
        accessibilityRole="button"
        accessibilityHint="Tap to open menu"
      >
        <NavContent navIcon={menuIcon} onPress={handleMenuPress} />
      </TouchableOpacity>
      <View style={PathNavigationStyles.centerNavigation}>
        <TouchableOpacity
          style={PathNavigationStyles.navArrowButton}
          onPress={handleLeftArrowPress}
          accessibilityLabel={`Previous ang: ${pathPujabiAng}`}
          accessibilityRole="button"
          accessibilityHint="Tap to go to previous ang"
        >
          <NavContent navIcon={leftArrowIcon} onPress={handleLeftArrowPress} />
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
          style={PathNavigationStyles.navArrowButton}
          onPress={handleRightArrowPress}
          accessibilityLabel={`Next ang: ${pathPujabiAng}`}
          accessibilityRole="button"
          accessibilityHint="Tap to go to next ang"
        >
          <NavContent navIcon={rightArrowIcon} onPress={handleRightArrowPress} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const PathNavigation = React.memo(PathNavigationComponent);
