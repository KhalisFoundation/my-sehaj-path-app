import { useCallback } from 'react';
import { ScrollView, Animated } from 'react-native';
import { showErrorAlert } from '@utils';
import { ErrorConstants } from '@constants';
import { DateData } from '@hooks';

interface UseScrollToSavedPathProps {
  matchedPathDate: DateData | undefined;
  pathContent: any;
  savedPathVerseId: number;
  scrolledToSavedPath: React.MutableRefObject<boolean>;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  scorllOffset: React.MutableRefObject<number>;
  fadeAnim: Animated.Value;
  setFound: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  fetchFontSize: () => Promise<{ number: number }>;
  scrollTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export const useScrollToSavedPath = ({
  matchedPathDate,
  pathContent,
  savedPathVerseId,
  scrolledToSavedPath,
  scrollRef,
  scorllOffset,
  fadeAnim,
  setFound,
  setIsSaving,
  setIsSaved,
  fetchFontSize,
  scrollTimeoutRef,
}: UseScrollToSavedPathProps) => {
  const scrollToSavedPathData = useCallback(async () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    if (matchedPathDate && !scrolledToSavedPath.current) {
      setFound(true);
      const scrollY = matchedPathDate.scrollPosition;
      scorllOffset.current = scrollY;
      scrollRef.current?.scrollTo({
        y: scorllOffset.current,
        animated: true,
      });
      scrolledToSavedPath.current = true;

      scrollTimeoutRef.current = setTimeout(() => {
        setFound(false);
        fadeAnim.setValue(1);
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }).start(() => {
          setIsSaving(false);
          setIsSaved(false);
        });
      }, 2000);
    }

    if (pathContent && !scrolledToSavedPath.current) {
      try {
        const scrollIndex = pathContent?.page?.findIndex(
          (page: any) => page.verseId === savedPathVerseId
        );
        const fontSize = await fetchFontSize();
        const fontSizeNumber = fontSize.number;
        let scrollHeight;
        if (fontSizeNumber <= 18) {
          scrollHeight = 25;
        } else if (fontSizeNumber <= 24) {
          scrollHeight = 50;
        } else if (fontSizeNumber <= 30) {
          scrollHeight = 100;
        } else {
          scrollHeight = 150;
        }
        if (scrollIndex !== -1) {
          const scrollY = scrollIndex * scrollHeight;
          setFound(true);
          scorllOffset.current = scrollY;
          scrollRef.current?.scrollTo({
            y: scorllOffset.current,
            animated: true,
          });
          scrolledToSavedPath.current = true;
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setFound(false);
          fadeAnim.setValue(1);
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 2500,
            useNativeDriver: true,
          }).start(() => {
            setIsSaving(false);
            setIsSaved(false);
          });
        }, 2000);
      } catch (error) {
        showErrorAlert(ErrorConstants.ERROR_SCROLLING_TO_SAVED_PATH);
      }
    }
  }, [
    matchedPathDate,
    pathContent,
    savedPathVerseId,
    scrolledToSavedPath,
    scrollRef,
    scorllOffset,
    fadeAnim,
    setFound,
    setIsSaving,
    setIsSaved,
    fetchFontSize,
    scrollTimeoutRef,
  ]);

  return { scrollToSavedPathData };
};
