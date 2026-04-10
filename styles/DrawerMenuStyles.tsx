import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

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
    backgroundColor: UIConstants.DRAWER_PANEL_BACKGROUND,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UIConstants.DRAWER_HEADER_BACKGROUND,
    paddingHorizontal: UIConstants.RHYTHM * 2,
    paddingVertical: UIConstants.RHYTHM * 1.2,
    gap: UIConstants.RHYTHM * 1.5,
  },
  logoContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: UIConstants.DRAWER_LOGO_TILE_BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: UIConstants.DRAWER_HEADER_TITLE_COLOR,
  },
  menuItems: {
    paddingTop: UIConstants.RHYTHM,
  },
  menuItemsHighlight: {
    fontWeight: '600',
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
    color: UIConstants.DRAWER_MENU_ITEM_COLOR,
    fontWeight: '400',
  },
  footer: {
    flexDirection: 'column',
    paddingHorizontal: UIConstants.RHYTHM * 3,
    paddingVertical: UIConstants.RHYTHM * 2,
  },
  donateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UIConstants.RHYTHM * 1.5,
    paddingVertical: UIConstants.RHYTHM * 1.5,
  },
  donateIcon: {
    fontSize: 20,
    color: UIConstants.DRAWER_DONATE_ACCENT,
  },
  donateText: {
    fontSize: 15,
    color: UIConstants.DRAWER_DONATE_ACCENT,
    fontWeight: '500',
  },
});
