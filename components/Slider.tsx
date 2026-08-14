import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Animated,
  LayoutAnimation,
  StyleProp,
  ViewStyle,
  Text,
  useWindowDimensions,
} from 'react-native';
import { SliderStyles } from '@styles';

interface Props {
  arrayOfCards: React.ReactNode[];
  widthOfCard: number;
  dotsIndicator: boolean;
  sliderContainerStyle?: StyleProp<ViewStyle>;
  dotsContainerStyle?: StyleProp<ViewStyle>;
  dotStyle?: StyleProp<ViewStyle>;
}

export const getActiveSliderPage = (
  offsetX: number,
  pageWidth: number,
  totalPages: number
): number => {
  if (totalPages <= 1 || pageWidth <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(totalPages - 1, Math.round(offsetX / pageWidth)));
};

export type SliderIndicator = number | 'ellipsis';
const VISIBLE_PAGE_INDICATORS = 6; // active dot + up to five inactive dots

/** Keep a large carousel indicator readable without losing its position cue. */
export const getSliderIndicators = (activeIndex: number, totalPages: number): SliderIndicator[] => {
  if (totalPages <= VISIBLE_PAGE_INDICATORS) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }

  const lastIndex = totalPages - 1;
  const maxStart = totalPages - VISIBLE_PAGE_INDICATORS;
  const windowStart = Math.max(0, Math.min(activeIndex - 2, maxStart));
  const windowEnd = windowStart + VISIBLE_PAGE_INDICATORS - 1;
  const pages = Array.from({ length: VISIBLE_PAGE_INDICATORS }, (_, index) => windowStart + index);

  return [
    ...(windowStart > 0 ? (['ellipsis'] as const) : []),
    ...pages,
    ...(windowEnd < lastIndex ? (['ellipsis'] as const) : []),
  ];
};

export const Slider = ({
  arrayOfCards,
  widthOfCard,
  dotsIndicator,
  sliderContainerStyle,
  dotStyle,
  dotsContainerStyle,
}: Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const previousActiveIndex = useRef(0);
  const { width } = useWindowDimensions();
  const activeDotScale = useRef(new Animated.Value(1)).current;
  const cardwidthOfCard = widthOfCard;
  const gap = 16;
  const scrollInterval = cardwidthOfCard + gap;
  const viewPortCards = Math.max(1, Math.floor(width / scrollInterval));
  const totalPages = Math.ceil(arrayOfCards.length / viewPortCards);
  const pageWidth = viewPortCards * scrollInterval;

  useEffect(() => {
    const changed = activeIndex !== previousActiveIndex.current;
    previousActiveIndex.current = activeIndex;
    if (!changed) {
      return;
    }

    activeDotScale.stopAnimation();
    activeDotScale.setValue(0.78);

    Animated.sequence([
      Animated.timing(activeDotScale, { toValue: 1.18, duration: 110, useNativeDriver: true }),
      Animated.spring(activeDotScale, {
        toValue: 1,
        damping: 14,
        stiffness: 220,
        mass: 0.55,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeDotScale, activeIndex]);

  const updateActivePage = (offsetX: number) => {
    const nextIndex = getActiveSliderPage(offsetX, pageWidth, totalPages);
    if (nextIndex === activeIndexRef.current) {
      return;
    }
    activeIndexRef.current = nextIndex;
    LayoutAnimation.configureNext({
      duration: 240,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: 'opacity' },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: 'opacity' },
    });
    setActiveIndex(nextIndex);
  };

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    updateActivePage(event.nativeEvent.contentOffset.x);
  };

  return (
    <>
      <FlatList
        data={arrayOfCards}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={pageWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => updateActivePage(event.nativeEvent.contentOffset.x)}
        style={[SliderStyles.sliderContainer, sliderContainerStyle]}
        contentContainerStyle={SliderStyles.sliderContentContainer}
        renderItem={({ item }) => <View>{item}</View>}
      />

      <View style={[SliderStyles.indicatorContainer, dotsContainerStyle]}>
        {dotsIndicator &&
          getSliderIndicators(activeIndex, totalPages).map((indicator, index) => {
            if (indicator === 'ellipsis') {
              return (
                <Text key={`ellipsis-${index}`} style={SliderStyles.ellipsis}>
                  …
                </Text>
              );
            }
            const isActive = activeIndex === indicator;
            const Dot = isActive ? Animated.View : View;
            let stateStyle = SliderStyles.inactiveDot;
            let animationStyle;
            if (isActive) {
              stateStyle = SliderStyles.activeDot;
              animationStyle = {
                transform: [{ scale: activeDotScale }],
              };
            }
            return (
              <Dot
                key={indicator}
                style={[SliderStyles.dots, dotStyle, stateStyle, animationStyle]}
              />
            );
          })}
      </View>
    </>
  );
};
