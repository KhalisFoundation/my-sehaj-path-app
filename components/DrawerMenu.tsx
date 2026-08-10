import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Animated,
  Modal,
  Pressable,
  Linking,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Constants,
  EDGES_DRAWER_MENU,
  ErrorConstants,
  KHALIS_FOUNDATION_DONATE_URL,
  UIConstants,
} from '@constants';
import { DrawerMenuStyles } from '@styles';
import { KhalisIcon, LoginIcon, SaveIcon } from '@icons';
import { showErrorAlert, showLogoutConfirmAlert, trackEvent } from '@utils';
import { DonationIcon } from '@icons/Donation.icon';
import { startLogin, logout } from '@auth';
import { DRAWER_MENU_ITEMS } from '../data/drawerMenu';
import { useAppSelector } from '../store/hooks';
import { store } from '../store';
import { resetSyncMetadataAndSync, runManualSync } from '../store/manualSync';

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

const logoutOverlayStyles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 35, 70, 0.72)',
  },
  text: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
});

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const authStatus = useAppSelector((state) => state.auth.status);
  const userEmail = useAppSelector((state) => state.auth.email);
  const recoveryNeeded = useAppSelector((state) => state.sync.recoveryNeeded);
  const isSignedIn = authStatus === 'signedIn';

  const handleLoginPress = () => {
    trackEvent('AuthButton', 'click', 'Sign in pressed');
    startLogin();
    onClose();
  };

  const handleLogoutPress = () => {
    trackEvent('AuthButton', 'click', 'Log out pressed');
    // Confirm first, then show a loading overlay while local logout settles.
    // The best-effort SSO browser logout opens afterwards without holding UI.
    showLogoutConfirmAlert({
      onConfirm: async () => {
        setIsLoggingOut(true);
        try {
          await logout();
        } finally {
          setIsLoggingOut(false);
          onClose();
        }
      },
    });
  };

  const performSync = async (repair = false) => {
    if (!userEmail) {
      return;
    }
    trackEvent('ManualSync', 'click', repair ? 'Reset sync metadata' : 'Sync now');
    const ok = repair
      ? await resetSyncMetadataAndSync(store, userEmail)
      : await runManualSync(store, userEmail);
    // A normal sync reports itself through the status notice — success and
    // failure both. Adding a blocking alert on top would mean two messages for
    // one tap. The repair path keeps the alert: it is a rare, explicit action
    // whose failure the user must not miss.
    if (!ok && repair) {
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
    }
  };

  const handleSyncPress = () => {
    if (!recoveryNeeded) {
      // Close first. This drawer is a Modal, which renders in its own window
      // above the app, so the status notice — an ordinary positioned View —
      // cannot draw over it no matter its zIndex. Leaving the menu open would
      // hide the very feedback this tap exists to produce.
      onClose();
      performSync();
      return;
    }
    Alert.alert(
      'Reset sync?',
      `Your saved paths will stay on this device. Resetting damaged sync information may add duplicate server paths when you sync again to ${
        userEmail ?? 'the signed-in account'
      }.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset and sync',
          onPress: () => {
            onClose();
            performSync(true);
          },
          style: 'destructive',
        },
      ]
    );
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
                        onPress={handleSyncPress}
                        accessibilityLabel={Constants.SYNC_NOW}
                        accessibilityRole="button"
                      >
                        <SaveIcon width={20} height={20} color="#11336A" />
                        <Text style={DrawerMenuStyles.logoutText}>{Constants.SYNC_NOW}</Text>
                      </TouchableOpacity>
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
          {isLoggingOut ? (
            <View style={logoutOverlayStyles.overlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={logoutOverlayStyles.text}>{Constants.LOGGING_OUT}</Text>
            </View>
          ) : null}
        </View>
      </SafeAreaProvider>
    </Modal>
  );
};

export const DrawerMenu = React.memo(DrawerMenuComponent);
