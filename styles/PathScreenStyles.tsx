import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const PathScreenStyles = StyleSheet.create({
  // Sits above the reader so a follower always knows the page is being moved
  // for them rather than by them.
  followingBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(17, 51, 106, 0.92)',
    paddingVertical: 12,
    // Clears the home indicator, so the label is not sitting under it.
    paddingBottom: 26,
    alignItems: 'center',
    zIndex: 20,
  },
  followingText: { color: 'white', fontSize: 13 },

  // Above the controls, not over them — a reader still needs every control
  // while this is showing.
  readerNotice: {
    position: 'absolute',
    bottom: 96,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(17, 51, 106, 0.94)',
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 20,
  },
  readerNoticeText: {
    alignSelf: 'stretch',
    color: 'white',
    fontSize: 13,
    includeFontPadding: false,
    lineHeight: 18,
    textAlign: 'center',
  },
  readerNoticeHint: {
    alignSelf: 'stretch',
    color: 'white',
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
  },

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
    height: 48,
    alignItems: 'center',
    justifyContent: 'space-around',
    alignSelf: 'center',
    borderRadius: 5,
    flexDirection: 'row',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlItem: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
