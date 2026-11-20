import { StyleSheet } from 'react-native';
import font from '@utils/font';
import { UIConstants } from '@constants';

export const FinishReadingSheetStyles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 20, 40, 0.45)',
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FDFCF7',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EADFC8',
    paddingVertical: 26,
    paddingHorizontal: UIConstants.RHYTHM * 2,
    alignItems: 'center',
    gap: 4,
  },

  tick: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#E4F1E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tickMark: { fontSize: 34, color: '#2E7D46' },

  title: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 20,
    color: UIConstants.PRIMARY_COLOR,
    marginBottom: 10,
    textAlign: 'center',
  },

  label: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 14,
    color: '#4A5F84',
    marginTop: 8,
  },
  // Tabular figures so 745 and 752 do not shift width against each other.
  figure: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 32,
    color: UIConstants.PRIMARY_COLOR,
    fontVariant: ['tabular-nums'],
  },

  readRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  readCount: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 40,
    color: UIConstants.PRIMARY_COLOR,
    fontVariant: ['tabular-nums'],
  },
  readRule: { width: 1, height: 40, backgroundColor: '#C9D3E4' },
  readUnit: { fontFamily: font.Baloo_Paaji_2_Regular, fontSize: 14, color: '#4A5F84' },

  confirm: {
    alignSelf: 'stretch',
    backgroundColor: UIConstants.PRIMARY_COLOR,
    borderRadius: 26,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmText: { fontFamily: font.Baloo_Paaji_2_Extra_Bold, fontSize: 17, color: 'white' },
  disabled: { opacity: 0.6 },

  cancel: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 15,
    color: '#2E5AAC',
    marginTop: 14,
  },
});
