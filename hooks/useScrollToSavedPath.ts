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
  /** True only while this hook is moving the reader to an existing checkpoint. */
  isRestoringScroll: React.MutableRefObject<boolean>;
  scrollRef: React.MutableRefObject<ScrollView | null>;
  scrollOffset: React.MutableRefObject<number>;
  fadeAnim: Animated.Value;
  setFound: (value: boolean) => void;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  /** Current font size from the store — no longer fetched from disk here. */
  fontSize: number;
}

export const useScrollToSavedPath = ({
  matchedPathDate,
  pathContent,
  savedPathVerseId,
  scrolledToSavedPath,
  isRestoringScroll,
  scrollRef,
  scrollOffset,
  fadeAnim,
  setFound,
  setIsSaving,
  setIsSaved,
  fontSize,
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
    if (matchedPathDate && !scrolledToSavedPath.current && scrollRef.current) {
      scrollOffset.current = matchedPathDate.scrollPosition;
      if (scrollRef.current) {
        // `scrollTo` emits the same `onScroll` events as a finger drag. Mark
        // this short auto-restore window so PathReader does not save an already
        // synced position as fresh progress.
        isRestoringScroll.current = true;
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
        const fontSizeNumber = fontSize;
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
            isRestoringScroll.current = true;
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
    matchedPathDate,
    pathContent,
    savedPathVerseId,
    scrolledToSavedPath,
    isRestoringScroll,
    scrollRef,
    scrollOffset,
    fadeAnim,
    runFadeSequence,
    fontSize,
  ]);

  return { scrollToSavedPathData };
};
