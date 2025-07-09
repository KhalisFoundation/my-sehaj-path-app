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
  scorllOffset: React.MutableRefObject<number>;
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
  scorllOffset,
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
            handleUpdatePath(pathId, pathAng, savedPathVerseId, scorllOffset.current, setIsSaved);
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
    scorllOffset,
  ]);

  return { handleGoBack };
};
