import { useCallback } from 'react';
import { showErrorAlert } from '@utils';
import { ErrorConstants, PATH_DATA } from '@constants';
import { ScrollView } from 'react-native';

export interface UseNavigationParams {
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  setIsAngNavigation: (value: boolean) => void;
  scrollOffset: React.MutableRefObject<number>;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  setPathAng: (value: number) => void;
  checkNetwork: () => Promise<boolean>;
  fetchFromBaniDB: (angNumber: number) => Promise<void>;
}

export const useNavigation = ({
  isNavigating,
  setIsNavigating,
  setIsSaving,
  setIsAngNavigation,
  scrollOffset,
  scrollRef,
  setPathAng,
  checkNetwork,
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
      setIsAngNavigation(false);
      setIsSaving(false);
      scrollOffset.current = 0;
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });

      try {
        const isConnected = await checkNetwork();
        if (!isConnected) {
          showErrorAlert(
            `${ErrorConstants.NO_INTERNET_TITLE} \n ${ErrorConstants.NO_INTERNET_MESSAGE}`
          );
          return;
        }
        await fetchFromBaniDB(pageNo + 1);
        setPathAng(pageNo + 1);
      } catch (error) {
        const isConnected = await checkNetwork();
        if (!isConnected) {
          showErrorAlert(
            `${ErrorConstants.NO_INTERNET_TITLE} \n ${ErrorConstants.NO_INTERNET_MESSAGE}`
          );
          return;
        } else {
          showErrorAlert(ErrorConstants.FAILED_TO_LOAD_NEXT_ANG);
        }
      } finally {
        setIsNavigating(false);
      }
    },
    [
      isNavigating,
      checkNetwork,
      setIsNavigating,
      setIsSaving,
      setIsAngNavigation,
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
      setIsAngNavigation(false);
      setIsSaving(false);
      scrollOffset.current = 0;
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });

      try {
        const isConnected = await checkNetwork();
        if (!isConnected) {
          showErrorAlert(
            `${ErrorConstants.NO_INTERNET_TITLE} \n ${ErrorConstants.NO_INTERNET_MESSAGE}`
          );
          return;
        }
        await fetchFromBaniDB(pageNo - 1);
        setPathAng(pageNo - 1);
      } catch (error) {
        const isConnected = await checkNetwork();
        if (!isConnected) {
          showErrorAlert(
            `${ErrorConstants.NO_INTERNET_TITLE} \n ${ErrorConstants.NO_INTERNET_MESSAGE}`
          );
        } else {
          showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PREVIOUS_ANG);
        }
      } finally {
        setIsNavigating(false);
      }
    },
    [
      isNavigating,
      setIsNavigating,
      setIsSaving,
      setIsAngNavigation,
      scrollOffset,
      scrollRef,
      setPathAng,
      checkNetwork,
      fetchFromBaniDB,
    ]
  );

  return {
    handleRightArrow,
    handleLeftArrow,
  };
};
