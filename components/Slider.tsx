import {
  View,
  FlatList,
  Animated,
  StyleProp,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import React, { useRef, useState } from "react";
import { SliderStyles } from "@styles";

interface Props {
  arrayOfCards: React.ReactNode[];
  widthOfCard: number;
  dotsIndicator: boolean;
  sliderContainerStyle?: StyleProp<ViewStyle>;
  dotsContainerStyle?: StyleProp<ViewStyle>;
  dotStyle?: StyleProp<ViewStyle>;
}

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
  const gap = 10;
  const scrollInterval = cardwidthOfCard + gap;
  const viewPortCards = Math.floor(width / scrollInterval);
  const totalPages = Math.ceil(arrayOfCards.length / viewPortCards);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const pageWidth = viewPortCards * scrollInterval;
        const index = Math.ceil(offsetX / pageWidth);
        setActiveIndex(index);
      },
    }
  );
  return (
    <>
      <FlatList
        data={arrayOfCards}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        style={[SliderStyles.sliderContainer, sliderContainerStyle]}
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
                  {
                    backgroundColor:
                      activeIndex === index
                        ? "#0D2346"
                        : "rgba(13, 35, 70, 0.1)",
                  },
                  dotStyle,
                ]}
              />
            );
          })}
      </View>
    </>
  );
};
