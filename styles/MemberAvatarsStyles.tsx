import { StyleSheet } from 'react-native';
import font from '@utils/font';

const SIZE = 24;

export const MemberAvatarsStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slot: {
    width: SIZE + 4,
    height: SIZE + 4,
    borderRadius: (SIZE + 4) / 2,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlap: {
    marginLeft: -SIZE / 3,
  },
  avatar: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  more: {
    backgroundColor: '#8A8F9A',
  },
  initial: {
    fontFamily: font.Brandon_Grotesque_Black,
    fontSize: 11,
    lineHeight: 13,
    color: 'white',
    textAlign: 'center',
  },
  count: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 13,
    lineHeight: 18,
    color: '#666666',
    flexShrink: 1,
  },
});
