import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';
import font from '@utils/font';

export const SettingScreenStyle = StyleSheet.create({
  container: {
    flex: 1,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D2346',
  },
  navText: {
    color: '#fff',
  },
  settingContainer: {
    marginTop: 15,
    padding: UIConstants.RHYTHM * 1.1,
    paddingTop: 0,
    // Room below the last row so it clears the home indicator when scrolled to
    // the end, rather than sitting flush against it.
    paddingBottom: UIConstants.RHYTHM * 3,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '50%',
    padding: UIConstants.RHYTHM * 1.5,
  },
  databaseUpdateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  databaseUpdateCopy: {
    flex: 1,
  },
  databaseUpdateText: {
    color: '#11336A',
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 20,
  },
  // Account deletion reuses the database row's shape so it sits flush with the
  // rest of the list; only the colour differs, because it is destructive.
  deleteAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  deleteAccountText: {
    color: '#B3261E',
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 20,
  },
});
