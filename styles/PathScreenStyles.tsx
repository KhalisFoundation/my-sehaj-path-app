import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const PathScreenStyles = StyleSheet.create({
  container: {
    height: '100%',
    width: '100%',
    paddingBottom: UIConstants.RHYTHM * 3,
  },
  pathContentContainer: {
    padding: UIConstants.RHYTHM,
    paddingTop: UIConstants.RHYTHM * 2,
  },
  navigationContainer: {
    position: 'absolute',
    bottom: 5,
    zIndex: 9,
    width: '100%',
    maxWidth: 200,
    backgroundColor: '#11336A',
    padding: UIConstants.RHYTHM * 0.9,
    height: 48,
    alignItems: 'center',
    justifyContent: 'space-around',
    alignSelf: 'center',
    borderRadius: 5,
    flexDirection: 'row',
  },
});
