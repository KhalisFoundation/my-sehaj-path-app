import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const PathNavigationStyles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0D2346',
  },
  menuButton: {
    padding: UIConstants.RHYTHM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerNavigation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: UIConstants.RHYTHM,
    paddingRight: UIConstants.RHYTHM * 2,
  },
  navArrowButton: {
    padding: UIConstants.RHYTHM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    minWidth: 80,
    backgroundColor: '#1E3A5F',
    borderRadius: 100,
  },
});
