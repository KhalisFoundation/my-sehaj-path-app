import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Animated,
  Modal,
  Pressable,
  Linking,
  StyleSheet,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Constants,
  EDGES_DRAWER_MENU,
  KHALIS_FOUNDATION_DONATE_URL,
  UIConstants,
} from '@constants';
import { DrawerMenuStyles } from '@styles';
import { KhalisIcon, LoginIcon } from '@icons';
import { trackEvent } from '@utils';
import { DonationIcon } from '@icons/Donation.icon';
import { startLogin, logout } from '@auth';
import { DRAWER_MENU_ITEMS } from '../data/drawerMenu';
import { useAppSelector } from '../store/hooks';

interface DrawerMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (route: string, pathId?: number) => void;
  currentRoute?: string;
  showOnlyHomeItems?: boolean;
  pathId?: number;
  onGoToAngPress?: () => void;
  onSavePress?: () => void;
}

const DrawerMenuComponent = ({
  isVisible,
  onClose,
  onNavigate,
  currentRoute,
  showOnlyHomeItems = false,
  pathId,
  onGoToAngPress,
  onSavePress,
}: DrawerMenuProps) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const authStatus = useAppSelector((state) => state.auth.status);
  const userEmail = useAppSelector((state) => state.auth.email);
  const isSignedIn = authStatus === 'signedIn';

  const handleLoginPress = () => {
    trackEvent('AuthButton', 'click', 'Sign in pressed');
    startLogin();
    onClose();
  };

  const handleLogoutPress = () => {
    trackEvent('AuthButton', 'click', 'Log out pressed');
    logout();
    onClose();
  };

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  const handleMenuItemPress = (route: string, label: string) => {
    trackEvent('DrawerMenuNavigation', 'click', `Navigate to ${label}`);
    if (route === 'GoToAng' && onGoToAngPress) {
      onGoToAngPress();
      onClose();
    } else if (route === 'Save' && onSavePress) {
      onSavePress();
      onClose();
    } else if ((route === 'Progress' || route === 'Streaks') && pathId) {
      onNavigate(route, pathId);
      onClose();
    } else {
      onNavigate(route);
      onClose();
    }
  };

  const menuItems = showOnlyHomeItems
    ? DRAWER_MENU_ITEMS.filter((item) => item.showOnHome)
    : DRAWER_MENU_ITEMS;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <View style={DrawerMenuStyles.modalRoot}>
          <BlurView
            blurType="light"
            blurAmount={2}
            reducedTransparencyFallbackColor={UIConstants.DRAWER_REDUCED_TRANSPARENCY_FALLBACK}
            style={StyleSheet.absoluteFill}
          />
          <View style={DrawerMenuStyles.drawerRow}>
            <View style={DrawerMenuStyles.drawerSlot}>
              <Animated.View
                style={[DrawerMenuStyles.drawerPanel, { transform: [{ translateX: slideAnim }] }]}
              >
                <SafeAreaView style={DrawerMenuStyles.drawerSafeArea} edges={EDGES_DRAWER_MENU}>
                  <View style={DrawerMenuStyles.header}>
                    <View style={DrawerMenuStyles.logoContainer}>
                      <KhalisIcon />
                    </View>
                    <Text style={DrawerMenuStyles.headerTitle}>{Constants.KHALIS_SEHAJ_PATH}</Text>
                  </View>
                  <View style={DrawerMenuStyles.menuItems}>
                    {menuItems.map((item) => {
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={DrawerMenuStyles.menuItem}
                          onPress={() => handleMenuItemPress(item.route, item.label)}
                          accessibilityLabel={item.label}
                          accessibilityRole="button"
                        >
                          <View style={DrawerMenuStyles.menuItemIcon}>
                            <item.Icon width={20} height={20} />
                          </View>
                          <Text
                            style={[
                              DrawerMenuStyles.menuItemText,
                              currentRoute === item.route && DrawerMenuStyles.menuItemsHighlight,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TouchableOpacity
                      style={DrawerMenuStyles.donateButton}
                      onPress={() => {
                        trackEvent('DonateButton', 'click', 'Donate button pressed');
                        Linking.openURL(KHALIS_FOUNDATION_DONATE_URL);
                      }}
                      accessibilityLabel={Constants.DONATE}
                      accessibilityRole="button"
                    >
                      <DonationIcon width={20} height={20} />
                      <Text style={DrawerMenuStyles.donateText}>{Constants.DONATE}</Text>
                    </TouchableOpacity>
                    {!isSignedIn ? (
                      <TouchableOpacity
                        style={DrawerMenuStyles.menuItem}
                        onPress={handleLoginPress}
                        accessibilityLabel={Constants.LOGIN}
                        accessibilityRole="button"
                      >
                        <View style={DrawerMenuStyles.menuItemIcon}>
                          <LoginIcon width={20} height={20} />
                        </View>
                        <Text style={DrawerMenuStyles.menuItemText}>{Constants.LOGIN}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  {isSignedIn ? (
                    <View style={DrawerMenuStyles.footer}>
                      <TouchableOpacity
                        style={DrawerMenuStyles.logoutButton}
                        onPress={handleLogoutPress}
                        accessibilityLabel={Constants.LOGOUT}
                        accessibilityRole="button"
                      >
                        <LoginIcon width={20} height={20} color="#11336A" />
                        <Text style={DrawerMenuStyles.logoutText}>{Constants.LOGOUT}</Text>
                      </TouchableOpacity>
                      {userEmail ? (
                        <View style={DrawerMenuStyles.emailRow}>
                          <Text style={DrawerMenuStyles.userEmail} numberOfLines={1}>
                            {userEmail}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </SafeAreaView>
              </Animated.View>
            </View>
            <Pressable
              style={DrawerMenuStyles.backdropPressable}
              onPress={onClose}
              accessibilityLabel={Constants.CLOSE_MENU}
              accessibilityRole="button"
            />
          </View>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
};

export const DrawerMenu = React.memo(DrawerMenuComponent);
