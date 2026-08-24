import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const LabelStyles = StyleSheet.create({
  label: {
    // Sits above the path cards, whose titles are 18 — a heading smaller than the
    // things it introduces read backwards.
    fontSize: 16,
    color: 'background: rgba(17, 51, 106, 1)',
    textAlign: 'center',
    margin: 10,
    fontFamily: font.Brandon_Grotesque_Regular,
  },
});
