import React, { useRef, useState } from 'react';
import { View, FlatList, Animated, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
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
  return Math.min(totalPages - 1, Math.ceil(offsetX / pageWidth));
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
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const cardwidthOfCard = widthOfCard;
  const gap = 16;
  const scrollInterval = cardwidthOfCard + gap;
  const viewPortCards = Math.max(1, Math.floor(width / scrollInterval));
  const totalPages = Math.ceil(arrayOfCards.length / viewPortCards);

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
    listener: (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const pageWidth = viewPortCards * scrollInterval;
      const index = getActiveSliderPage(offsetX, pageWidth, totalPages);
      setActiveIndex(index);
    },
  });
  return (
    <>
      <FlatList
        data={arrayOfCards}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        style={[SliderStyles.sliderContainer, sliderContainerStyle]}
        contentContainerStyle={SliderStyles.sliderContentContainer}
        renderItem={({ item }) => <View>{item}</View>}
      />

      <View style={[SliderStyles.indicatorContainer, dotsContainerStyle]}>
        {dotsIndicator &&
          Array.from({ length: totalPages }).map((_, index) => {
            return (
              <View
                key={index}
                style={[
                  SliderStyles.dots,
                  dotStyle,
                  activeIndex === index ? SliderStyles.activeDot : SliderStyles.inactiveDot,
                ]}
              />
            );
          })}
      </View>
    </>
  );
};
