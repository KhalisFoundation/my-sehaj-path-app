import { useCallback } from 'react';
import { showErrorAlert, recordError } from '@utils';
import { ErrorConstants, PATH_DATA } from '@constants';
import { ScrollView } from 'react-native';

export interface UseNavigationParams {
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  scrollOffset: React.MutableRefObject<number>;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  setPathAng: (value: number) => void;
  fetchFromBaniDB: (angNumber: number) => Promise<boolean>;
}

export const useNavigation = ({
  isNavigating,
  setIsNavigating,
  setIsSaving,
  scrollOffset,
  scrollRef,
  setPathAng,
  fetchFromBaniDB,
}: UseNavigationParams) => {
  const handleRightArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      if (pageNo >= PATH_DATA.LAST_ANG_NUMBER) {
        return;
      }
      setIsNavigating(true);
      setIsSaving(false);
      scrollOffset.current = 0;
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });

      try {
        if (await fetchFromBaniDB(pageNo + 1)) {
          setPathAng(pageNo + 1);
        }
      } catch (error) {
        recordError(error, `useNavigation: failed to load next ang from ${pageNo}`);
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_NEXT_ANG);
      } finally {
        setIsNavigating(false);
      }
    },
    [
      isNavigating,
      setIsNavigating,
      setIsSaving,
      scrollOffset,
      scrollRef,
      fetchFromBaniDB,
      setPathAng,
    ]
  );

  const handleLeftArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      if (pageNo <= 1) {
        return;
      }

      setIsNavigating(true);
      setIsSaving(false);
      scrollOffset.current = 0;
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });

      try {
        if (await fetchFromBaniDB(pageNo - 1)) {
          setPathAng(pageNo - 1);
        }
      } catch (error) {
        recordError(error, `useNavigation: failed to load previous ang from ${pageNo}`);
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PREVIOUS_ANG);
      } finally {
        setIsNavigating(false);
      }
    },
    [
      isNavigating,
      setIsNavigating,
      setIsSaving,
      scrollOffset,
      scrollRef,
      setPathAng,
      fetchFromBaniDB,
    ]
  );

  return {
    handleRightArrow,
    handleLeftArrow,
  };
};
