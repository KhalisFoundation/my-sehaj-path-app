import { StyleSheet } from 'react-native';

export const typography = StyleSheet.create({
  default: {
    fontFamily: 'WorkSans_400Regular',
  },
  bold: {
    fontFamily: 'WorkSans_700Bold',
  },
});

export const applyTypography = (style) => {
  return [typography.default, style];
};