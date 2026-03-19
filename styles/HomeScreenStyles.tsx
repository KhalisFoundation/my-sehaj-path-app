import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const HomeScreenStyles = StyleSheet.create({
  backgroundImage: {
    height: '100%',
  },
  container: {
    backgroundColor: 'rgba(245, 245, 245,0.89)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: UIConstants.PADDING,
    height: '100%',
    borderWidth: 4,
    borderRightWidth: 5,
    borderColor: 'rgba(253, 198, 6, 0.3)',
  },
  scrollContainer: {
    minHeight: '100%',
  },
  pathInProgressContianer: {
    marginTop: UIConstants.RHYTHM * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pathCompletedContainer: {
    marginTop: UIConstants.RHYTHM * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    position: 'absolute',
    top: UIConstants.RHYTHM * 2,
    left: UIConstants.RHYTHM * 2,
    zIndex: 10,
    padding: UIConstants.RHYTHM,
  },
});
