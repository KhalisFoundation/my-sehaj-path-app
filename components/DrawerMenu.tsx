import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, Animated, Modal, Pressable, Linking } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { DrawerMenuStyles } from '@styles';
import { 
  ProgressIcon,
  StreakIcon,
  GoToAngIcon,
  AllPathLogoIcon,
  KhalisIcon
} from '@icons';
import { trackEvent } from '@utils';
import { SaveIconMenu } from '@icons/SaveIconMenu.icon';
import { SettingsMenu } from '@icons/SettingsMenu.icon';
import { DonationIcon } from '@icons/Donation.icon';

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

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
  showOnHome?: boolean;
}

const DrawerMenuComponent = ({ 
  isVisible, 
  onClose, 
  onNavigate,
  currentRoute,
  showOnlyHomeItems = false,
  pathId,
  onGoToAngPress,
  onSavePress
}: DrawerMenuProps) => {
  const slideAnim = useRef(new Animated.Value(-300)).current;

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

  const allMenuItems: MenuItem[] = [
    {
      id: 'all-paths',
      label: 'All Paths',
      icon: <AllPathLogoIcon />,
      route: 'Home',
      showOnHome: true,
    },
    {
      id: 'progress',
      label: 'Progress',
      icon: <ProgressIcon />,
      route: 'Progress',
      showOnHome: false,
    },
    {
      id: 'streaks',
      label: 'Streaks',
      icon: <StreakIcon />,
      route: 'Streaks',
      showOnHome: false,
    },
    {
      id: 'go-to-ang',
      label: 'Go To Ang',
      icon: <GoToAngIcon />,
      route: 'GoToAng',
      showOnHome: false,
    },
    {
      id: 'save',
      label: 'Save',
      icon: <SaveIconMenu />,
      route: 'Save',
      showOnHome: false,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsMenu />,
      route: 'Setting',
      showOnHome: true,
    },
    // Required only when the khalis SSO will be implemented in near future
    // {
    //   id: 'login',
    //   label: 'Login',
    //   icon: <LoginIcon />,
    //   route: 'Login',
    //   showOnHome: true,
    // },
  ];

  const menuItems = showOnlyHomeItems 
    ? allMenuItems.filter(item => item.showOnHome)
    : allMenuItems;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <BlurView
        style={DrawerMenuStyles.overlay}
        blurType="light"
        blurAmount={10}
        reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.5)"
      >
        <Pressable style={DrawerMenuStyles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            DrawerMenuStyles.drawerContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
        <View style={DrawerMenuStyles.header}>
            <View style={DrawerMenuStyles.logoContainer}>
            <KhalisIcon />
            </View>
            <Text style={DrawerMenuStyles.headerTitle}>Khalis Sehaj Path</Text>
        </View>
          <Pressable>

            <View style={DrawerMenuStyles.menuItems}>
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={DrawerMenuStyles.menuItem}
                  onPress={() => handleMenuItemPress(item.route, item.label)}
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                >
                  <View style={DrawerMenuStyles.menuItemIcon}>{item.icon}</View>
                  <Text style={[
                    DrawerMenuStyles.menuItemText,
                    (currentRoute === item.route) && DrawerMenuStyles.menuItemsHighlight,
                  ]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
              <View style={DrawerMenuStyles.footer}>
                <TouchableOpacity
                  style={DrawerMenuStyles.donateButton}
                  onPress={() => {
                    trackEvent('DonateButton', 'click', 'Donate button pressed');
                    Linking.openURL('https://khalisfoundation.org/donate/');
                  }}
                  accessibilityLabel="Donate"
                  accessibilityRole="button"
                >
                  <DonationIcon />
                  <Text style={DrawerMenuStyles.donateText}>Donate</Text>
                </TouchableOpacity>
              </View>

          </Pressable>
        </Animated.View>
        </Pressable>
      </BlurView>
    </Modal>
  );
};

export const DrawerMenu = React.memo(DrawerMenuComponent);
