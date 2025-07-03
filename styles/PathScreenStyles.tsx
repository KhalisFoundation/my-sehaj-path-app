import { StyleSheet } from 'react-native';
import font from '../utils/font';

export const PathScreenStyles = StyleSheet.create({
  container: {
    borderWidth: 4,
    borderRightWidth: 5,
    borderColor: 'rgba(253, 198, 6, 0.3)',
    height: '100%',
    width: '100%',
    paddingBottom: 40,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    position: 'absolute',
    right: 10,
    zIndex: 8,
  },
  pathContentContainer: {
    padding: 15,
    paddingTop: 20,
  },

  navigationContainer: {
    position: 'absolute',
    bottom: 5,
    zIndex: 9,
    width: '100%',
    maxWidth: 258,
    backgroundColor: '#11336A',
    padding: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'space-around',
    alignSelf: 'center',
    borderRadius: 5,
    flexDirection: 'row',
  },
});
