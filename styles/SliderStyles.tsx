import { StyleSheet } from 'react-native';

export const SliderStyles = StyleSheet.create({
  sliderContainer: {
    flexGrow: 0,
    paddingBottom: 10,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 26,
    flexWrap: 'wrap',
  },
  dots: {
    width: 8,
    height: 8,
    borderRadius: 5,
  },
});
