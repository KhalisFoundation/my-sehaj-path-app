import { StyleSheet } from 'react-native';

export const SliderStyles = StyleSheet.create({
  sliderContainer: {
    flexGrow: 0,
    paddingBottom: 10,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
    flexWrap: 'wrap',
  },
  dots: {
    width: 8,
    height: 8,
    borderRadius: 5,
  },
  activeDot: {
    backgroundColor: '#0D2346',
  },
  inactiveDot: {
    backgroundColor: 'rgba(13, 35, 70, 0.1)',
  },
});
