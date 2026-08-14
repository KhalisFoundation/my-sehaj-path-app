import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';
import font from '@utils/font';

export const DrawerMenuStyles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdropPressable: {
    flex: 1,
  },
  drawerRow: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerSlot: {
    width: 280,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  drawerSafeArea: {
    flex: 1,
  },
  drawerPanel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#F5F5F5',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11336A',
    paddingHorizontal: UIConstants.RHYTHM * 2,
    paddingVertical: UIConstants.RHYTHM * 1.2,
    gap: UIConstants.RHYTHM * 1.5,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: font.Baloo_Paaji_2_Medium,
    color: '#FFFFFF',
  },
  menuItems: {
    paddingTop: UIConstants.RHYTHM,
  },
  menuItemsHighlight: {
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: UIConstants.RHYTHM * 3,
    paddingVertical: UIConstants.RHYTHM,
    gap: UIConstants.RHYTHM,
  },
  menuItemIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: '#2C3E50',
    fontFamily: font.Baloo_Paaji_2_Regular,
  },
  footer: {
    flexDirection: 'column',
    marginTop: 'auto',
    paddingTop: 0,
    paddingBottom: UIConstants.RHYTHM * 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#B8C5D6',
    gap: 0,
  },
  emailRow: {
    marginTop: UIConstants.RHYTHM * 0.5,
    paddingHorizontal: UIConstants.RHYTHM * 3,
  },
  userEmail: {
    fontSize: 13,
    color: '#7F8C8D',
    fontFamily: font.Baloo_Paaji_2_Regular,
    marginTop: UIConstants.RHYTHM * 0.5,
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UIConstants.RHYTHM * 1.5,
    marginHorizontal: UIConstants.RHYTHM * 3,
    paddingVertical: UIConstants.RHYTHM,
  },
  donateIcon: {
    fontSize: 20,
    color: '#F39C12',
  },
  donateText: {
    fontSize: 15,
    color: '#F39C12',
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UIConstants.RHYTHM * 0.5,
    marginHorizontal: UIConstants.RHYTHM * 3,
    paddingVertical: UIConstants.RHYTHM,
  },
  logoutText: {
    fontSize: 15,
    color: '#11336A',
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
});
