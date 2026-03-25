import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Routes } from '@constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const useDrawerNavigation = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleDrawerNavigate = useCallback((route: string, pathId?: number) => {
    switch (route) {
      case 'Home':
        navigation.navigate(Routes.Home);
        break;
      case 'Setting':
        navigation.navigate(Routes.Setting);
        break;
      case 'Progress':
        // Navigate to Continue screen with the current pathId to show progress
        if (pathId) {
          navigation.push(Routes.Continue, { pathId, initialTab: 'progress' });
        }
        break;
      case 'Streaks':
        // Navigate to Continue screen with the current pathId to show streak tab
        if (pathId) {
          navigation.push(Routes.Continue, { pathId, initialTab: 'streak' });
        }
        break;
      case 'GoToAng':
        // Handling this using callback
        break;
      case 'Save':
        // Handling this using callback
        break;
      case 'Login':
        // Add navigation when Login screen is implemented
        // navigation.navigate(Routes.Login);
        break;
      default:
        break;
    }
  }, [navigation]);

  return { handleDrawerNavigate };
};
