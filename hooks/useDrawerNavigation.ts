import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Routes } from '@constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const useDrawerNavigation = () => {
  const navigation = useNavigation<NavigationProp>();

  const handleDrawerNavigate = useCallback(
    (route: string, pathId?: number) => {
      const navigateToContinue = (initialTab: 'progress' | 'streak') => {
        if (!pathId) {
          return;
        }

        navigation.push(Routes.Continue, {
          pathId,
          initialTab,
        });
      };

      const routeHandlers: Record<string, () => void> = {
        Home: () => navigation.navigate(Routes.Home),
        Setting: () => navigation.navigate(Routes.Setting),
        Progress: () => navigateToContinue('progress'),
        Streaks: () => navigateToContinue('streak'),
      };

      routeHandlers[route]?.();
    },
    [navigation]
  );

  return { handleDrawerNavigate };
};
