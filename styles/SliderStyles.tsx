import { StyleSheet } from 'react-native';

export const SliderStyles = StyleSheet.create({
  sliderContainer: {
    flexGrow: 0,
    paddingBottom: 10,
  },
  sliderContentContainer: {
    gap: 16,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
  },
  dots: {
    width: 8,
    height: 8,
    borderRadius: 5,
  },
  ellipsis: {
    width: 8,
    height: 12,
    lineHeight: 10,
    textAlign: 'center',
    color: 'rgba(13, 35, 70, 0.45)',
    fontSize: 12,
  },
  activeDot: {
    backgroundColor: '#0D2346',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  inactiveDot: {
    backgroundColor: 'rgba(13, 35, 70, 0.1)',
  },
});
