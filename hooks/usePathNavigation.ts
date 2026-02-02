import { useCallback } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showSaveProgressAlert } from '@utils/alerts';
import { useLocal } from './useLocal';
import { RootStackParamList } from '../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UsePathNavigationProps {
  isAngNavigation: boolean;
  pathAng: number;
  savedPathVerseId: number;
  pathId: number;
  setIsSaved: (value: boolean) => void;
  setIsAngNavigation: (value: boolean) => void;
  updatePathAng: (angNumber: number) => void;
  scrollOffset: React.MutableRefObject<number>;
  navigation: NavigationProp;
}

export const usePathNavigation = ({
  isAngNavigation,
  pathAng,
  savedPathVerseId,
  pathId,
  setIsSaved,
  setIsAngNavigation,
  updatePathAng,
  scrollOffset,
  navigation,
}: UsePathNavigationProps) => {
  const { fetchFromLocal, handleUpdatePath } = useLocal();

  const handleGoBack = useCallback(async () => {
    if (isAngNavigation) {
      const { pathDataArray } = await fetchFromLocal();
      const currentMatchedPath = pathDataArray.find((path) => path.pathId === pathId);
      const lastSavedAngNumber = currentMatchedPath?.saveData.angNumber || 0;

      if (pathAng !== lastSavedAngNumber) {
        showSaveProgressAlert({
          onSaveAndGoBack: () => {
            // If the user is going back to the previous ang, and the saved verseId is not 0 (0 means no verse was saved on this ang), then update the path
            if (savedPathVerseId >= 0) {
              handleUpdatePath(pathId, pathAng, savedPathVerseId, scrollOffset.current, setIsSaved);
            }
            setIsAngNavigation(false);
            navigation.push('Home');
          },
          onGoBackWithoutSaving: () => {
            updatePathAng(lastSavedAngNumber);
            navigation.push('Home');
          },
        });
      } else {
        navigation.push('Home');
      }
    } else {
      navigation.push('Home');
    }
  }, [
    isAngNavigation,
    pathAng,
    handleUpdatePath,
    pathId,
    savedPathVerseId,
    setIsSaved,
    setIsAngNavigation,
    navigation,
    fetchFromLocal,
    updatePathAng,
    scrollOffset,
  ]);

  return { handleGoBack };
};
