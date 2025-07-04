import { useCallback } from 'react';
import { showErrorAlert, convertNumberToFormat } from '@utils';

export interface UseNavigationParams {
  isNavigating: boolean;
  setIsNavigating: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  scorllOffset: React.MutableRefObject<number>;
  scrollRef: React.MutableRefObject<any>;
  setAngNavigationNumber: (value: number) => void;
  setPathPunjabiAng: (value: string) => void;
  setPathAng: (value: number) => void;
  angsFormat: { format: string };
  checkNetwork: () => void;
  isOnline: boolean;
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
  isOnline,
  fetchFromBaniDB,
}: UseNavigationParams) => {
  const handleRightArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      checkNetwork();
      if (!isOnline) {
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
        showErrorAlert('Failed to load the next ang. Please try again.');
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
      isOnline,
      fetchFromBaniDB,
    ]
  );

  const handleLeftArrow = useCallback(
    async (pageNo: number) => {
      if (isNavigating) {
        return;
      }
      checkNetwork();
      if (!isOnline) {
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
        showErrorAlert('Failed to load the previous ang. Please try again.');
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
      isOnline,
      fetchFromBaniDB,
    ]
  );

  return {
    handleRightArrow,
    handleLeftArrow,
  };
};
