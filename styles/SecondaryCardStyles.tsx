import { StyleSheet } from 'react-native';
import font from '../utils/font';

export const CompletedPathCardStyles = StyleSheet.create({
  container: {
    width: 130,
    height: 107,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#11336A',
    shadowOffset: { width: 15, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 45,
    elevation: 5,
    marginRight: 16,
  },
  sehajText: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#11336A',
  },
  dateText: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#666666',
    marginTop: 4,
  },
});
