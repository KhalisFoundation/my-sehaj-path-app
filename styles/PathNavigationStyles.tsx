import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const PathNavigationStyles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    gap: UIConstants.RHYTHM,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: UIConstants.RHYTHM * 1,
    paddingHorizontal: UIConstants.RHYTHM * 2,
    backgroundColor: '#0D2346',
  },
  navText: {
    color: '#fff',
  },
  arrowButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
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
