import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, Animated, Modal, Pressable } from 'react-native';
import { DrawerMenuStyles } from '@styles';
import { 
  HomeIcon,
  ProgressIcon,
  StreakIcon,
  GoToAngIcon,
  LoginIcon,
  AllPathLogoIcon
} from '@icons';
import { trackEvent } from '@utils';
import { SaveIconMenu } from '@icons/SaveIconMenu.icon';
import { SettingsMenu } from '@icons/SettingsMenu.icon';
import { DonationIcon } from '@icons/Donation.icon';

interface DrawerMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  currentRoute?: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
}

const DrawerMenuComponent = ({ 
  isVisible, 
  onClose, 
  onNavigate,
  currentRoute 
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
    onNavigate(route);
    onClose();
  };

  const menuItems: MenuItem[] = [
    {
      id: 'all-paths',
      label: 'All Paths',
      icon: <AllPathLogoIcon />,
      route: 'Home',
    },
    {
      id: 'progress',
      label: 'Progress',
      icon: <ProgressIcon />,
      route: 'Progress',
    },
    {
      id: 'streaks',
      label: 'Streaks',
      icon: <StreakIcon />,
      route: 'Streaks',
    },
    {
      id: 'go-to-ang',
      label: 'Go To Ang',
      icon: <GoToAngIcon />,
      route: 'GoToAng',
    },
    {
      id: 'save',
      label: 'Save',
      icon: <SaveIconMenu />,
      route: 'Save',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsMenu />,
      route: 'Setting',
    },
    {
      id: 'login',
      label: 'Login',
      icon: <LoginIcon />,
      route: 'Login',
    },
  ];

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
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
            <HomeIcon />
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
                  <Text style={DrawerMenuStyles.menuItemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={DrawerMenuStyles.footer}>
              <TouchableOpacity
                style={DrawerMenuStyles.donateButton}
                onPress={() => {
                  trackEvent('DonateButton', 'click', 'Donate button pressed');
                  // Handle donate action
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
    </Modal>
  );
};

export const DrawerMenu = React.memo(DrawerMenuComponent);
