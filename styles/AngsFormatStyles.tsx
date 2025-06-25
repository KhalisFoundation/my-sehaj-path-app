import { StyleSheet } from 'react-native';
import font from '../utils/font';

export const AngsFormatStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  angsText: {
    fontSize: 20,
    fontFamily: font.Brandon_Grotesque_Regular,
    color: '#11336A',
  },
  angsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontFamily: font.Brandon_Grotesque_Regular,
    color: '#11336A',
  },
  overlayContainer: {
    width: '80%',
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overlayContent: {
    marginTop: 15,
    width: '100%',
  },
  overlayTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayText: {
    fontSize: 16,
    fontFamily: font.Brandon_Grotesque_Regular,
    color: '#11336A',
    textAlign: 'left',
    justifyContent: 'space-between',
  },
});
