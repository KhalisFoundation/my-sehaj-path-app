import font from '@utils/font';
import { StyleSheet } from 'react-native';

export const MessageStyles = StyleSheet.create({
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    zIndex: 100,
    width: '100%',
    maxWidth: 356,
    height: 48,
    alignSelf: 'center',
    padding: 10,
    alignItems: 'center',
    flexDirection: 'row',
    borderRadius: 10,
    backgroundColor: '#11336A',
    gap: 10,
  },

  saveText: {
    color: '#fff',
    fontFamily: font.Baloo_Paaji_2_Medium,
    fontSize: 16,
  },
});
