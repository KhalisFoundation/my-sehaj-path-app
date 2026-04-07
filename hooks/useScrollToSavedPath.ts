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
  scrollOffset: React.MutableRefObject<number>;
  fadeAnim: Animated.Value;
  setFound: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  fetchFontSize: () => Promise<{ number: number }>;
}

export const useScrollToSavedPath = ({
  matchedPathDate,
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
    if (scrolledToSavedPath.current || !scrollRef.current) {
      return;
    }

    try {
      // Prefer verse on the *current* page first. Raw scrollPosition can be from another ang
      // (e.g. 1430) and would clamp badly after navigating to 1429, then findCenter + autosave
      // would persist the wrong verse.
      if (pathContent?.page && savedPathVerseId) {
        const scrollIndex = pathContent.page.findIndex(
          (page: any) => page.verseId === savedPathVerseId
        );
        if (scrollIndex !== -1) {
          // Approximate line height buckets keep restore fast without measuring every row.
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
          scrollOffset.current = scrollIndex * scrollHeight;
          scrollRef.current.scrollTo({
            y: scrollOffset.current,
            animated: true,
          });
          scrolledToSavedPath.current = true;
          fadeAnim.setValue(1);
          runFadeSequence();
          return;
        }
      }

      if (matchedPathDate) {
        // Fallback to raw scroll offset when saved verse is not on this ang.
        // Stored value uses ScrollView `contentOffset.y` (type: number, vertical pixels).
        scrollOffset.current = matchedPathDate.scrollPosition;
        scrollRef.current.scrollTo({
          y: scrollOffset.current,
          animated: true,
        });
        scrolledToSavedPath.current = true;
        fadeAnim.setValue(1);
        runFadeSequence();
      }
    } catch (error) {
      showErrorAlert(ErrorConstants.ERROR_SCROLLING_TO_SAVED_PATH);
    }
  }, [
    matchedPathDate,
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
