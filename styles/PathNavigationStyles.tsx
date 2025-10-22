import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const PathNavigationStyles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    gap: UIConstants.RHYTHM * 5,
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#0D2346',
  },
  navText: {
    color: '#fff',
  },
  arrowButton: {
    flex: 1,
    width: '100%',
    maxWidth: 100,
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: UIConstants.RHYTHM * 2,
  },
  arrowButtonRight: {
    alignItems: 'flex-end',
  },
  angs: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: UIConstants.RHYTHM * 0.5,
    minWidth: 99,
    backgroundColor: '#FFFFFF1A',
    borderRadius: 100,
  },
});
