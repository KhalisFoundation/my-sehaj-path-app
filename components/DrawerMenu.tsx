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
import { KhalisIcon } from '@icons';
import { trackEvent } from '@utils';
import { DonationIcon } from '@icons/Donation.icon';
import { DRAWER_MENU_ITEMS } from '../data/drawerMenu';

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
  const slideAnim = useRef(new Animated.Value(UIConstants.DRAWER_ANIMATION_HIDDEN_OFFSET)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(slideAnim, {
        toValue: UIConstants.DRAWER_ANIMATION_VISIBLE_OFFSET,
        duration: UIConstants.DRAWER_ANIMATION_OPEN_DURATION,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: UIConstants.DRAWER_ANIMATION_HIDDEN_OFFSET,
        duration: UIConstants.DRAWER_ANIMATION_CLOSE_DURATION,
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
            style={StyleSheet.absoluteFillObject}
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
                      const RowIcon = item.Icon;
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={DrawerMenuStyles.menuItem}
                          onPress={() => handleMenuItemPress(item.route, item.label)}
                          accessibilityLabel={item.label}
                          accessibilityRole="button"
                        >
                          <View style={DrawerMenuStyles.menuItemIcon}>
                            <RowIcon />
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
                  </View>
                  <View style={DrawerMenuStyles.footer}>
                    <TouchableOpacity
                      style={DrawerMenuStyles.donateButton}
                      onPress={() => {
                        trackEvent('DonateButton', 'click', 'Donate button pressed');
                        Linking.openURL(KHALIS_FOUNDATION_DONATE_URL);
                      }}
                      accessibilityLabel={Constants.DONATE}
                      accessibilityRole="button"
                    >
                      <DonationIcon />
                      <Text style={DrawerMenuStyles.donateText}>{Constants.DONATE}</Text>
                    </TouchableOpacity>
                  </View>
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
