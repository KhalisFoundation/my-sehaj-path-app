import font from '@utils/font';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

const dateCellBase: ViewStyle = {
  height: 24,
  width: 24,
  borderRadius: 3,
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
};

const dateTextBase: TextStyle = {
  fontSize: 16,
  fontFamily: font.Baloo_Paaji_2_Medium,
};

export const CalenderStyles = StyleSheet.create({
  calenderContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 15,
    width: '100%',
  },
  calenderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calenderHeaderText: {
    fontSize: 16,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
  },
  calenderDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calenderDay: {
    fontSize: 16,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
    flex: 1,
    textAlign: 'center',
  },
  calenderDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calenderRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 8,
    gap: 10,
  },
  calenderDate: {
    ...dateCellBase,
    backgroundColor: '#D9D9D9',
  },
  emptyDate: {
    ...dateCellBase,
    backgroundColor: 'transparent',
  },
  progressDate: {
    ...dateCellBase,
    backgroundColor: '#418A39',
  },
  emptyProgressDate: {
    ...dateCellBase,
    backgroundColor: '#6A6A6A',
  },
  dateText: {
    ...dateTextBase,
    color: '#999999',
  },
  progressDateText: {
    ...dateTextBase,
    color: 'white',
  },
  lightningIcon: {
    fontSize: 10,
    color: '#FFD700',
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
  streakText: {
    fontSize: 16,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#11336A',
    textAlign: 'center',
    marginTop: 10,
  },
});
