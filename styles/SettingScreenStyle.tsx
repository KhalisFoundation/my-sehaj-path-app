import { StyleSheet } from 'react-native';

export const SettingScreenStyle = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 4,
    borderRightWidth: 5,
    borderColor: 'rgba(253, 198, 6, 0.3)',
    padding: 15,
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingContainer: {
    marginTop: 15,
  },
});
