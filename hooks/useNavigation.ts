import { useCallback } from 'react';
import { showErrorAlert, convertNumberToFormat } from '@utils';
import { ErrorConstants } from '@constants/ErrorConstant';
import { ScrollView } from 'react-native';
import { AngsFormat } from './useLocal';

export interface UseNavigationParams {
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  scorllOffset: React.MutableRefObject<number>;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  setAngNavigationNumber: (value: number) => void;
  setPathPunjabiAng: (value: string) => void;
  setPathAng: (value: number) => void;
  angsFormat: AngsFormat;
  checkNetwork: () => Promise<boolean>;
  fetchFromBaniDB: (angNumber: number) => Promise<void>;
  setAutoScroll?: (value: boolean) => void;
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
  setAutoScroll,
}: UseNavigationParams) => {
  const handleRightArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      checkNetwork().then((isConnected) => {
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
        setAutoScroll?.(false);
        scorllOffset.current = 0;
        scrollRef.current?.scrollTo({
          y: 0,
          animated: true,
        });

        fetchFromBaniDB(pageNo + 1)
          .then(() => {
            setAngNavigationNumber(pageNo + 1);
            setPathPunjabiAng(
              convertNumberToFormat({
                number: pageNo + 1,
                format: angsFormat.format,
              })
            );
            setPathAng(pageNo + 1);
          })
          .catch((_error) => {
            showErrorAlert(ErrorConstants.FAILED_TO_LOAD_NEXT_ANG);
          })
          .finally(() => {
            setIsNavigating(false);
          });
      });
    },
    [
      isNavigating,
      checkNetwork,
      setIsNavigating,
      setIsSaving,
      setAutoScroll,
      scorllOffset,
      scrollRef,
      fetchFromBaniDB,
      setAngNavigationNumber,
      setPathPunjabiAng,
      angsFormat.format,
      setPathAng,
    ]
  );

  const handleLeftArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      checkNetwork().then((isConnected) => {
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
        setAutoScroll?.(false);
        scorllOffset.current = 0;
        scrollRef.current?.scrollTo({
          y: 0,
          animated: true,
        });
        fetchFromBaniDB(pageNo - 1)
          .then(() => {
            setAngNavigationNumber(pageNo - 1);
            setPathPunjabiAng(
              convertNumberToFormat({
                number: pageNo - 1,
                format: angsFormat.format,
              })
            );
            setPathAng(pageNo - 1);
          })
          .catch((_error) => {
            showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PREVIOUS_ANG);
          })
          .finally(() => {
            setIsNavigating(false);
          });
      });
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
      setAutoScroll,
    ]
  );

  return {
    handleRightArrow,
    handleLeftArrow,
  };
};
