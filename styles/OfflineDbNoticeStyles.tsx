import { StyleSheet } from 'react-native';

export const OfflineDbNoticeStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 35, 70, 0.94)',
    zIndex: 1000,
    elevation: 6,
  },
  success: {
    backgroundColor: 'rgba(21, 92, 52, 0.96)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});
