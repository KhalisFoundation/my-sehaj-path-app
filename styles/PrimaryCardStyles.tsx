import { StyleSheet } from 'react-native';
import font from '@utils/font';

export const PathProgressCardStyles = StyleSheet.create({
  container: {
    width: 199,
    height: 220,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginRight: 16,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 2,
    // A path name can wrap to two lines, so the leading below has to carry the
    // rhythm; `gap` only separates the name from the ang beneath it.
    gap: 4,
  },
  sehajText: {
    fontFamily: font.Brandon_Grotesque_Black,
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    color: '#11336A',
  },
  angText: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 16,
    lineHeight: 25,
    textAlign: 'center',
    color: '#666666',
  },
  angNumber: {
    fontFamily: 'BrandonGrotesque-Bold',
    color: '#11336A',
  },
  progressContainer: {
    width: 53,
    height: 53,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
});
