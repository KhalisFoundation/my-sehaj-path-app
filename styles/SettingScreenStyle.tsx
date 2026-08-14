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
});
