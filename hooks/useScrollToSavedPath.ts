import { useCallback } from 'react';
import { ScrollView, Animated } from 'react-native';
import { showErrorAlert } from '@utils';
import { ErrorConstants } from '@constants';
import { DateData } from '@hooks';

interface UseScrollToSavedPathProps {
  matchedPathDateRef: React.MutableRefObject<DateData | undefined>;
  pathContent: any;
  savedPathVerseId: number;
  scrolledToSavedPath: React.MutableRefObject<boolean>;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  scrollOffset: React.MutableRefObject<number>;
  fadeAnim: Animated.Value;
  setFound: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  fetchFontSize: () => Promise<{ number: number }>;
}

export const useScrollToSavedPath = ({
  matchedPathDateRef,
  pathContent,
  savedPathVerseId,
  scrolledToSavedPath,
  scrollRef,
  scrollOffset,
  fadeAnim,
  setFound,
  setIsSaving,
  setIsSaved,
  fetchFontSize,
}: UseScrollToSavedPathProps) => {
  const runFadeSequence = useCallback(() => {
    setFound(true);

    Animated.sequence([
      Animated.delay(2500),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 2500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      requestAnimationFrame(() => {
        setIsSaving(false);
        setIsSaved(false);
        setFound(false);
      });
    });
  }, [fadeAnim, setFound, setIsSaving, setIsSaved]);

  const scrollToSavedPathData = useCallback(async () => {
    const matchedPathDate = matchedPathDateRef.current;

    if (matchedPathDate && !scrolledToSavedPath.current && scrollRef.current) {
      scrollOffset.current = matchedPathDate.scrollPosition;
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          y: scrollOffset.current,
          animated: true,
        });
      }
      scrolledToSavedPath.current = true;
      fadeAnim.setValue(1);
      runFadeSequence();
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
          scrollOffset.current = scrollIndex * scrollHeight;
          if (scrollRef.current) {
            scrollRef.current.scrollTo({
              y: scrollOffset.current,
              animated: true,
            });
          }
          scrolledToSavedPath.current = true;
          fadeAnim.setValue(1);
          runFadeSequence();
        }
      } catch (error) {
        showErrorAlert(ErrorConstants.ERROR_SCROLLING_TO_SAVED_PATH);
      }
    }
  }, [
    matchedPathDateRef,
    pathContent,
    savedPathVerseId,
    scrolledToSavedPath,
    scrollRef,
    scrollOffset,
    fadeAnim,
    runFadeSequence,
    fetchFontSize,
  ]);

  return { scrollToSavedPathData };
};
