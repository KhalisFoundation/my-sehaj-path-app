import { useCallback } from 'react';
import { showErrorAlert, convertNumberToFormat } from '@utils';
import { ErrorConstants } from '@constants/ErrorConstant';
import { ScrollView } from 'react-native';

export interface UseNavigationParams {
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  scorllOffset: React.MutableRefObject<number>;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  setAngNavigationNumber: (value: number) => void;
  setPathPunjabiAng: (value: string) => void;
  setPathAng: (value: number) => void;
  angsFormat: { format: string };
  checkNetwork: () => Promise<boolean>;
  fetchFromBaniDB: (angNumber: number) => Promise<void>;
}

export const useNavigation = ({
  isNavigating,
  setIsNavigating,
  setIsSaving,
  scorllOffset,
  scrollRef,
  setAngNavigationNumber,
  setPathPunjabiAng,
  setPathAng,
  angsFormat,
  checkNetwork,
  fetchFromBaniDB,
}: UseNavigationParams) => {
  const handleRightArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      const isConnected = await checkNetwork();
      if (!isConnected) {
        showErrorAlert(
          ErrorConstants.NO_INTERNET_TITLE + '\n' + ErrorConstants.NO_INTERNET_MESSAGE
        );
        return;
      }
      if (pageNo >= 1430) {
        return;
      }
      setIsNavigating(true);
      setIsSaving(false);
      scorllOffset.current = 0;
      scrollRef.current?.scrollTo({
        y: 0,
        animated: true,
      });

      try {
        await fetchFromBaniDB(pageNo + 1);
        setAngNavigationNumber(pageNo + 1);
        setPathPunjabiAng(convertNumberToFormat(pageNo + 1, angsFormat.format));
        setPathAng(pageNo + 1);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_NEXT_ANG);
      } finally {
        setIsNavigating(false);
      }
    },
    [
      isNavigating,
      setIsNavigating,
      setIsSaving,
      scorllOffset,
      scrollRef,
      setAngNavigationNumber,
      setPathPunjabiAng,
      setPathAng,
      angsFormat,
      checkNetwork,
      fetchFromBaniDB,
    ]
  );

  const handleLeftArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      const isConnected = await checkNetwork();
      if (!isConnected) {
        showErrorAlert(
          ErrorConstants.NO_INTERNET_TITLE + '\n' + ErrorConstants.NO_INTERNET_MESSAGE
        );
        return;
      }
      if (pageNo <= 1) {
        return;
      }
      setIsNavigating(true);
      setIsSaving(false);
      scorllOffset.current = 0;
      scrollRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
      try {
        await fetchFromBaniDB(pageNo - 1);
        setAngNavigationNumber(pageNo - 1);
        setPathPunjabiAng(convertNumberToFormat(pageNo - 1, angsFormat.format));
        setPathAng(pageNo - 1);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PREVIOUS_ANG);
      } finally {
        setIsNavigating(false);
      }
    },
    [
      isNavigating,
      setIsNavigating,
      setIsSaving,
      scorllOffset,
      scrollRef,
      setAngNavigationNumber,
      setPathPunjabiAng,
      setPathAng,
      angsFormat,
      checkNetwork,
      fetchFromBaniDB,
    ]
  );

  return {
    handleRightArrow,
    handleLeftArrow,
  };
};
