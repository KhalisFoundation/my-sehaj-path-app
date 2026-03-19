import { StyleSheet } from 'react-native';
import { UIConstants } from '@constants/UIConstants';

export const DrawerMenuStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
  },
  drawerContainer: {
    width: 280,
    height: '100%',
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
    fontWeight: '600',
    color: '#FFFFFF',
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
    color: '#2C3E50',
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
    color: '#F39C12',
  },
  donateText: {
    fontSize: 15,
    color: '#F39C12',
    fontWeight: '500',
  },
});
