import { useCallback } from 'react';
import { ScrollView } from 'react-native';
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
  setFound: (value: boolean) => void;
  /** Current font size from the store — no longer fetched from disk here. */
  fontSize: number;
  /**
   * Paragraph mode measures verse positions from the rendered paragraph flow,
   * so the fixed-height estimate below does not apply there.
   */
  isParagraphMode: boolean;
}

export const useScrollToSavedPath = ({
  matchedPathDate,
  pathContent,
  savedPathVerseId,
  scrolledToSavedPath,
  isRestoringScroll,
  scrollRef,
  scrollOffset,
  setFound,
  fontSize,
  isParagraphMode,
}: UseScrollToSavedPathProps) => {
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
      // PathScreen owns the one shared fade/cleanup sequence for both a saved
      // verse and a restored position. Starting a second sequence here made
      // Android animate the same value twice and stutter on resume.
      setFound(true);
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
            // `scrollIndex * scrollHeight` assumes every verse is one
            // fixed-height line. That holds in line mode, so animate straight to
            // it. In PARAGRAPH mode verses are merged into wrapped paragraphs, so
            // this is only a rough starting point: place it instantly (it is the
            // reader's initial position, not a visible move) and let the measured
            // recentre animate to the true position. Animating to the estimate
            // first is what produced the janky resume.
            //
            // This estimate deliberately still runs in paragraph mode: it is the
            // fallback if measurement never resolves (e.g. no `onTextLayout`
            // lines), which would otherwise leave the reader not scrolled at all.
            scrollRef.current.scrollTo({
              y: scrollOffset.current,
              animated: !isParagraphMode,
            });
          }
          scrolledToSavedPath.current = true;
          setFound(true);
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
    setFound,
    fontSize,
    isParagraphMode,
  ]);

  return { scrollToSavedPathData };
};
