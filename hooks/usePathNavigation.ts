import { useCallback } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showLeaveAnywayAlert, showSaveProgressAlert } from '@utils/alerts';
import { store } from '../store';
import { RootStackParamList } from '../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UsePathNavigationProps {
  isAngNavigation: boolean;
  pathAng: number;
  pathId: number;
  setIsAngNavigation: (value: boolean) => void;
  updatePathAng: (angNumber: number) => void;
  navigation: NavigationProp;
  /** Persists the current position; resolves false if it could not be saved. */
  persistCurrentScroll: () => Promise<boolean>;
}

export const usePathNavigation = ({
  isAngNavigation,
  pathAng,
  pathId,
  setIsAngNavigation,
  updatePathAng,
  navigation,
  persistCurrentScroll,
}: UsePathNavigationProps) => {
  const persistAndGoHome = useCallback(async () => {
    const saved = await persistCurrentScroll();
    if (!saved) {
      // Never trap the user: let them retry (stay) or leave anyway. Leaving is
      // their explicit choice, so we don't force them to stay on a broken disk.
      showLeaveAnywayAlert({ onLeaveAnyway: () => navigation.push('Home') });
      return;
    }
    navigation.push('Home');
  }, [persistCurrentScroll, navigation]);

  const handleGoBack = useCallback(async () => {
    if (isAngNavigation) {
      const currentMatchedPath = store
        .getState()
        .paths.paths.find((path) => path.pathId === pathId);
      const lastSavedAngNumber = currentMatchedPath?.saveData.angNumber || 0;

      if (pathAng !== lastSavedAngNumber) {
        showSaveProgressAlert({
          onSaveAndGoBack: async () => {
            setIsAngNavigation(false);
            await persistAndGoHome();
          },
          onGoBackWithoutSaving: () => {
            updatePathAng(lastSavedAngNumber);
            navigation.push('Home');
          },
        });
      } else {
        await persistAndGoHome();
      }
    } else {
      await persistAndGoHome();
    }
  }, [
    isAngNavigation,
    pathAng,
    pathId,
    persistAndGoHome,
    setIsAngNavigation,
    navigation,
    updatePathAng,
  ]);

  return { handleGoBack };
};
