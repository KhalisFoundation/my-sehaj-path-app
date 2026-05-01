import { useCallback } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showSaveProgressAlert } from '@utils/alerts';
import { useLocal } from './useLocal';
import { RootStackParamList } from '../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UsePathNavigationProps {
  isAngNavigation: boolean;
  pathAng: number;
  pathId: number;
  setIsAngNavigation: (value: boolean) => void;
  updatePathAng: (angNumber: number) => void;
  navigation: NavigationProp;
  persistCurrentScroll: () => Promise<void>;
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
  const { fetchFromLocal } = useLocal();
  const persistAndGoHome = useCallback(async () => {
    await persistCurrentScroll();
    navigation.push('Home');
  }, [persistCurrentScroll, navigation]);

  const handleGoBack = useCallback(async () => {
    if (isAngNavigation) {
      const { pathDataArray } = await fetchFromLocal();
      const currentMatchedPath = pathDataArray.find((path) => path.pathId === pathId);
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
    fetchFromLocal,
    updatePathAng,
  ]);

  return { handleGoBack };
};
