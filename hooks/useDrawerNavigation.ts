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

        const params = { pathId, initialTab };
        const state = navigation.getState();
        const currentRoute = state.routes[state.index]?.name;

        // Path is normally opened from Continue. Pushing here created
        // Home -> Continue -> Path -> Continue, so Back appeared to reopen
        // Continue and the heavy reader route briefly exposed a blank frame.
        if (currentRoute === Routes.Path) {
          navigation.popTo(Routes.Continue, params);
          return;
        }

        navigation.push(Routes.Continue, params);
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
