import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
  Linking,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text } from './AppText';
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
import {
  recordError,
  showErrorAlert,
  showLogoutConfirmAlert,
  showUnsyncedBeforeLogoutAlert,
  showOfflineBeforeLogoutAlert,
  showOfflineSyncAlert,
  trackEvent,
} from '@utils';
import { DonationIcon } from '@icons/Donation.icon';
import { startLogin, logout } from '@auth';
import { DRAWER_MENU_ITEMS } from '../data/drawerMenu';
import { useAppSelector } from '../store/hooks';
import { store } from '../store';
import { clearLocalDataForLogout, restoreCloudDataAfterSyncRecovery } from '../store/confirmedSync';
import { runManualSync } from '../store/manualSync';
import { isFullyBackedUp } from '../store/syncWork';
import { setRecoveryRestoreStatus } from '../store/slices/syncSlice';

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
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const manualSyncInFlight = useRef(false);
  const authStatus = useAppSelector((state) => state.auth.status);
  const userEmail = useAppSelector((state) => state.auth.email);
  const recoveryNeeded = useAppSelector((state) => state.sync.recoveryNeeded);
  const isOnline = useAppSelector((state) => state.network.isOnline);
  const isSignedIn = authStatus === 'signedIn';

  const handleLoginPress = () => {
    trackEvent('AuthButton', 'click', 'Sign in pressed');
    startLogin();
    onClose();
  };

  /**
   * Sign out and leave the guest UI behind.
   *
   * The local copy is removed so a signed-out device never shows the previous
   * account's reading. Clearing is attempted first, while still signed in: if it
   * cannot be made durable, stay signed in. Signing out while the previous
   * account's paths remain would expose that account's data in guest mode.
   */
  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (!(await clearLocalDataForLogout(store))) {
        recordError(
          new Error('logout: local data could not be cleared'),
          'drawer: logout clear failed'
        );
        showErrorAlert(ErrorConstants.FAILED_TO_LOG_OUT);
        return;
      }
      await logout();
    } finally {
      setIsLoggingOut(false);
      onClose();
    }
  };

  const confirmThenLogout = () => showLogoutConfirmAlert({ onConfirm: performLogout });

  /**
   * Sync first, and only offer logout once it actually landed. Re-checking after
   * the sync rather than trusting its return value keeps the gate honest: a
   * partial success still leaves reading that only exists here.
   */
  const syncThenOfferLogout = async () => {
    if (manualSyncInFlight.current) {
      return;
    }
    // Offline is checked FIRST, and before the email.
    //
    // Being signed in does not guarantee we know who: `establishSession` signs in
    // on the stored token alone when the profile request fails, leaving
    // `auth.email` null until a later fetch succeeds — and offline, that fetch
    // never succeeds. Testing the email first therefore turned every offline tap
    // into a silent no-op, blaming a missing profile for what is really a missing
    // connection. Offline is also the thing the user can actually act on.
    if (!isOnline) {
      showOfflineBeforeLogoutAlert();
      return;
    }
    // Online but still no profile: a sync cannot be addressed to an account we
    // cannot name. Rare and self-healing, but it must never be a dead button.
    if (!userEmail) {
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
      return;
    }
    // Close the drawer first, exactly as `handleSyncPress` does. This menu is a
    // Modal rendered in its own window, so the sync status notice — an ordinary
    // positioned View — cannot draw over it at any zIndex. Left open, it would
    // hide the very progress this tap exists to show.
    onClose();
    manualSyncInFlight.current = true;
    setIsManualSyncing(true);
    let synced = false;
    try {
      trackEvent('ManualSync', 'click', 'Sync before logout');
      synced = await runManualSync(store, userEmail);
    } finally {
      manualSyncInFlight.current = false;
      setIsManualSyncing(false);
    }
    if (isFullyBackedUp(store)) {
      // Straight to the logout question — the status notice has already shown
      // "Synced", so a separate confirmation would be the same news twice.
      confirmThenLogout();
      return;
    }
    // A failed sync reports itself through that same notice, and `performSync`
    // deliberately avoids adding a second message for one tap. Speak up only in
    // the case the notice cannot describe: the sync claimed success, yet reading
    // still exists only on this device.
    if (synced) {
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
    }
  };

  const handleLogoutPress = () => {
    trackEvent('AuthButton', 'click', 'Log out pressed');
    // Logging out now DELETES the local copy, so reading the server has not
    // confirmed would be gone for good. Every path starts `onServer: false`, so
    // this is reachable through ordinary use — reading offline, a failed sync,
    // or logging out before the outbox drains.
    if (!isFullyBackedUp(store)) {
      // How often real users actually hit this gate is the question that decides
      // whether the whole prompt earns its place — and pairs with the
      // 'Sync before logout' event below to show how many finish the sync
      // rather than abandoning the logout.
      trackEvent('Logout', 'blocked', 'unsynced progress');
      showUnsyncedBeforeLogoutAlert({ onSyncNow: syncThenOfferLogout });
      return;
    }
    trackEvent('Logout', 'click', 'fully backed up');
    // Confirm first, then show a loading overlay while local logout settles.
    // The best-effort SSO browser logout opens afterwards without holding UI.
    confirmThenLogout();
  };

  const performSync = async () => {
    if (manualSyncInFlight.current) {
      return;
    }
    // Same trap as the logout path: signed in does not mean we know who. When
    // `establishSession` could not fetch the profile, `auth.email` stays null and
    // this returned silently — a Sync now button that did nothing at all, with no
    // message to explain it.
    if (!userEmail) {
      showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
      return;
    }
    manualSyncInFlight.current = true;
    setIsManualSyncing(true);
    try {
      trackEvent('ManualSync', 'click', 'Sync now');
      // A normal sync reports itself through the status notice — success and
      // failure both. Adding a blocking alert on top would mean two messages for
      // one tap.
      await runManualSync(store, userEmail);
    } finally {
      manualSyncInFlight.current = false;
      setIsManualSyncing(false);
    }
  };

  const restoreFromCloud = async () => {
    if (!userEmail || manualSyncInFlight.current) {
      return;
    }
    manualSyncInFlight.current = true;
    setIsManualSyncing(true);
    try {
      trackEvent('ManualSync', 'click', 'Restore cloud backup');
      store.dispatch(setRecoveryRestoreStatus('restoring'));
      if (await restoreCloudDataAfterSyncRecovery(store, userEmail)) {
        store.dispatch(setRecoveryRestoreStatus('restored'));
      } else {
        store.dispatch(setRecoveryRestoreStatus('idle'));
        showErrorAlert(ErrorConstants.FAILED_TO_SYNC);
      }
    } finally {
      manualSyncInFlight.current = false;
      setIsManualSyncing(false);
    }
  };

  const handleSyncPress = () => {
    if (!recoveryNeeded) {
      // Offline is a precondition, not an outcome — same as the logout path.
      // Checked before the menu closes, so it stays put and the tap has a
      // visible answer rather than dismissing the drawer and little else.
      if (!isOnline) {
        showOfflineSyncAlert();
        return;
      }
      // Close first. This drawer is a Modal, which renders in its own window
      // above the app, so the status notice — an ordinary positioned View —
      // cannot draw over it no matter its zIndex. Leaving the menu open would
      // hide the very feedback this tap exists to produce.
      onClose();
      performSync();
      return;
    }
    Alert.alert(
      'Sync information damaged',
      'Your paths are safe on this device, but we cannot safely match them to your cloud paths. Sync is paused to prevent duplicates.',
      [
        {
          text: 'Keep local data',
          style: 'cancel',
          onPress: () => {
            onClose();
            store.dispatch(setRecoveryRestoreStatus('paused'));
          },
        },
        {
          text: 'Restore from cloud',
          onPress: () => {
            Alert.alert(
              'Replace local paths?',
              `This will replace the paths on this device with the cloud backup for ${
                userEmail ?? 'the signed-in account'
              }. This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Restore from cloud',
                  style: 'destructive',
                  onPress: () => {
                    onClose();
                    restoreFromCloud();
                  },
                },
              ]
            );
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
                        disabled={isManualSyncing}
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
