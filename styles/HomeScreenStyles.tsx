import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const HomeScreenStyles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    backgroundColor: UIConstants.SCREEN_OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
    padding: UIConstants.PADDING,
    flex: 1,
    borderWidth: 4,
    borderColor: UIConstants.SCREEN_BORDER_COLOR,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  pathInProgressContianer: {
    marginTop: UIConstants.RHYTHM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletedNotice: {
    bottom: UIConstants.RHYTHM * 3,
    alignItems: 'center',
  },
  pathCompletedContainer: {
    marginTop: UIConstants.RHYTHM,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedCardsContent: {
    paddingHorizontal: UIConstants.RHYTHM,
  },
  progressDots: {
    marginTop: UIConstants.RHYTHM,
  },
  menuButton: {
    position: 'absolute',
    top: UIConstants.RHYTHM * 1.5,
    left: UIConstants.RHYTHM * 1.5,
    zIndex: 10,
  },
});
