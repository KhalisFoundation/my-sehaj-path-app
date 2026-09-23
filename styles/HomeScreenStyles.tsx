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
    flex: 1,
    borderWidth: 4,
    borderRightWidth: 5,
    borderColor: 'rgba(253, 198, 6, 0.3)',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  pathInProgressContianer: {
    marginTop: UIConstants.RHYTHM * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /**
   * Lifts the confirmation clear of the screen edge. The shared default is
   * flush to the bottom for the reader, where it tucks under the controls;
   * here there is nothing beneath it, so it needs its own breathing room.
   */
  deletedNotice: {
    bottom: UIConstants.RHYTHM * 3,
    alignItems: 'center',
  },
  pathCompletedContainer: {
    marginTop: UIConstants.RHYTHM * 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuButton: {
    position: 'absolute',
    top: UIConstants.RHYTHM * 1.5,
    left: UIConstants.RHYTHM * 1.5,
    zIndex: 10,
  },
});
