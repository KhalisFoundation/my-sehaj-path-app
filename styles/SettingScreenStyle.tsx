import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const SettingScreenStyle = StyleSheet.create({
  container: {
    flex: 1,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D2346',
    padding: UIConstants.RHYTHM * 1.5,
    paddingHorizontal: 0,
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
    width: '100%',
    paddingLeft: UIConstants.RHYTHM * 1.5,
  },
});
