import React, { useCallback, useMemo } from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { ScrollView } from 'react-native';
import { SimpleTextForPath } from '@components';
import { PathReaderStyles } from '@styles';
import { PathNextAng } from './PathNextAng';
import { trackEvent } from '@utils/analytics';

interface PathReaderProps {
  pathContent: any;
  isLarivaar: boolean;
  isSaving: boolean;
  pressIndex: number;
  savedPathVerseId: number;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollOffset: React.RefObject<number>;
  isAngNavigation: boolean;
  debouncedScrollSave: () => void;
  handleRightArrow: (pageNo: number) => void;
  handleLeftArrow: (pageNo: number) => void;
  setPressIndex: (index: number) => void;
  setSavedPathVerseId: (verseId: number) => void;
  handleUpdatePathWithErrorHandling: (
    pathId: number,
    pageNo: number,
    verseId: number,
    scrollPosition: number,
    setIsSaved: (value: boolean) => void
  ) => void;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  pathId: number;
  isNavigating: boolean;
  found: boolean;
  setFound: (value: boolean) => void;
}

const PathReaderComponent = ({
  pathContent,
  isLarivaar,
  isSaving,
  pressIndex,
  savedPathVerseId,
  scrollRef,
  scrollOffset,
  isAngNavigation,
  debouncedScrollSave,
  handleRightArrow,
  handleLeftArrow,
  setPressIndex,
  setSavedPathVerseId,
  handleUpdatePathWithErrorHandling,
  setIsSaving,
  setIsSaved,
  pathId,
  isNavigating,
  found,
  setFound,
}: PathReaderProps) => {
  const handleAngChange = useCallback(() => {
    trackEvent('AngsByBottomNav', 'click', 'next ang from bottom nav');
    handleRightArrow(pathContent?.source?.pageNo);
  }, [handleRightArrow, pathContent?.source?.pageNo]);

  const handleSwipeLeft = useCallback(() => {
    handleRightArrow(pathContent?.source?.pageNo);
  }, [handleRightArrow, pathContent?.source?.pageNo]);

  const handleSwipeRight = useCallback(() => {
    handleLeftArrow(pathContent?.source?.pageNo);
  }, [handleLeftArrow, pathContent?.source?.pageNo]);

  const handleScroll = useCallback(
    (e: any) => {
      const scrollY = e.nativeEvent.contentOffset.y;
      scrollOffset.current = scrollY;
      if (!isAngNavigation) {
        debouncedScrollSave();
      }
    },
    [isAngNavigation, debouncedScrollSave, scrollOffset]
  );

  const gestureConfig = useMemo(
    () => ({
      velocityThreshold: 0.8,
      directionalOffsetThreshold: 80,
      gestureIsClickThreshold: 10,
    }),
    []
  );

  const createSelectionHandler = useCallback(
    (index: number, verseId: number) => () => {
      if (isSaving) {
        setPressIndex(index + 1);
        setSavedPathVerseId(verseId);
      }
    },
    [isSaving, setPressIndex, setSavedPathVerseId]
  );

  const createSaveHandler = useCallback(
    (verseId: number) => () => {
      handleUpdatePathWithErrorHandling(
        pathId,
        pathContent?.source?.pageNo,
        verseId,
        scrollOffset.current,
        setIsSaved
      );
    },
    [
      pathId,
      pathContent?.source?.pageNo,
      scrollOffset,
      handleUpdatePathWithErrorHandling,
      setIsSaved,
    ]
  );

  const pageContent = useMemo(() => {
    return pathContent?.page?.map((path: any, index: number) => {
      const gurbaniLine = isLarivaar ? path.larivaar.unicode : path.verse.unicode;

      return (
        <SimpleTextForPath
          key={`${path.verseId}-${index}`}
          gurbaniLine={gurbaniLine}
          onSelection={createSelectionHandler(index, path.verseId)}
          onSave={createSaveHandler(path.verseId)}
          isSaving={isSaving}
          pressIndex={pressIndex}
          index={index + 1}
          verseId={path.verseId}
          savedPathVerseId={savedPathVerseId}
          setIsSaving={setIsSaving}
          setIsSaved={setIsSaved}
          setPressIndex={setPressIndex}
          setSavedPathVerseId={setSavedPathVerseId}
          found={found}
          setFound={setFound}
        />
      );
    });
  }, [
    pathContent?.page,
    isLarivaar,
    isSaving,
    pressIndex,
    savedPathVerseId,
    createSelectionHandler,
    createSaveHandler,
    setIsSaving,
    setIsSaved,
    setPressIndex,
    setSavedPathVerseId,
    found,
    setFound,
  ]);

  return (
    <GestureRecognizer
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
      onSwipeDown={() => undefined}
      onSwipeUp={() => undefined}
      config={gestureConfig}
    >
      <ScrollView
        contentContainerStyle={PathReaderStyles.pathContentContainer}
        ref={scrollRef}
        nestedScrollEnabled={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={() => false}
        removeClippedSubviews={true}
      >
        {pageContent}
        {pathContent?.source?.pageNo < 1430 && !isNavigating && (
          <PathNextAng pathAng={pathContent?.source?.pageNo} handleRightArrow={handleAngChange} />
        )}
      </ScrollView>
    </GestureRecognizer>
  );
};

export const PathReader = React.memo(PathReaderComponent);
