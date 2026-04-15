import React, { useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { ScrollView, View } from 'react-native';
import { ParagraphTextForPath, SimpleTextForPath } from '@components';
import { PathReaderStyles } from '@styles';
import { PathNextAng } from './PathNextAng';
import { usePathReaderCentering } from './usePathReaderCentering';
import { trackEvent } from '@utils/analytics';
import { PATH_DATA } from '@constants';
import type { Verse, PathContent } from '@hooks';

interface PathReaderProps {
  pathContent: PathContent;
  isLarivaar: boolean;
  isParagraphMode: boolean;
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
  ) => Promise<boolean>;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  pathId: number;
  isNavigating: boolean;
  found: boolean;
  setFound: (value: boolean) => void;
  fontSize: number;
  isSaved: boolean;
  isVishraam: boolean;
  vishraamsSource: string;
  vishraamsStyle: string;
  onSaveCommit?: (
    angNumber: number,
    verseId: number,
    scrollPosition?: number,
    clearAngNavigation?: boolean
  ) => void;
  setCenterVerseId?: (verseId: number) => void;
  scrollToVerseId?: number;
  scrollToVerseRequestKey?: number;
  scrolledToSavedPath: React.MutableRefObject<boolean>;
  onScrollEndDrag?: (scrollY: number) => void;
}

const PathReaderComponent = ({
  pathContent,
  isLarivaar,
  isParagraphMode,
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
  fontSize,
  isSaved,
  isVishraam,
  vishraamsSource,
  vishraamsStyle,
  onSaveCommit,
  setCenterVerseId,
  scrollToVerseId,
  scrollToVerseRequestKey,
  scrolledToSavedPath,
  onScrollEndDrag,
}: PathReaderProps) => {
  const {
    clearMeasuredVerses,
    createLayoutHandler,
    createParagraphVerseLayoutHandler,
    createShabadLayoutHandler,
    findCenterVerseId,
    handleViewportLayout,
    requestRecenter,
  } = usePathReaderCentering({
    scrollRef,
    scrollOffset,
    setCenterVerseId,
    scrollToVerseId,
  });

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
      findCenterVerseId(scrollY);

      if (!isAngNavigation) {
        debouncedScrollSave();
      }
    },
    [isAngNavigation, debouncedScrollSave, scrollOffset, findCenterVerseId]
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
    (verseId: number) => async () => {
      const saved = await handleUpdatePathWithErrorHandling(
        pathId,
        pathContent?.source?.pageNo,
        verseId,
        scrollOffset.current,
        setIsSaved
      );
      if (saved && onSaveCommit) {
        onSaveCommit(pathContent?.source?.pageNo ?? 0, verseId, scrollOffset.current, true);
      }
    },
    [
      pathId,
      pathContent?.source?.pageNo,
      scrollOffset,
      handleUpdatePathWithErrorHandling,
      setIsSaved,
      onSaveCommit,
    ]
  );

  // Clear verse positions when page changes
  useLayoutEffect(() => {
    clearMeasuredVerses(true);
  }, [clearMeasuredVerses, pathContent?.source?.pageNo]);

  // Clear verse positions when font size or paragraph mode changes
  useLayoutEffect(() => {
    clearMeasuredVerses();
  }, [clearMeasuredVerses, fontSize, isParagraphMode]);

  // Reset scroll flag when scrollToVerseId changes
  useEffect(() => {
    requestRecenter(scrollToVerseId);
  }, [requestRecenter, scrollToVerseId, scrollToVerseRequestKey]);

  const shabadsWithIndices = useMemo(() => {
    if (!pathContent?.page) {
      return [];
    }

    const versesByShabadId = pathContent.page.reduce(
      (groupedVerses: Record<number, Verse[]>, verse: Verse) => {
        if (!groupedVerses[verse.shabadId]) {
          groupedVerses[verse.shabadId] = [];
        }
        groupedVerses[verse.shabadId].push(verse);
        return groupedVerses;
      },
      {}
    );

    let startIndex = 0;
    return Object.values(versesByShabadId).map((verses) => {
      const shabad = { startIndex, verses };
      startIndex += verses.length;
      return shabad;
    });
  }, [pathContent?.page]);

  const pageContent = useMemo(() => {
    if (isParagraphMode) {
      return (
        <View>
          {shabadsWithIndices.map((shabad, shabadIndex) => (
            <View
              key={shabadIndex}
              onLayout={createShabadLayoutHandler(shabadIndex)}
              style={{
                marginBottom: 14,
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              {shabad.verses.map((verse: Verse, verseIndex: number) => {
                const gurbaniLine = isLarivaar ? verse.larivaar.unicode : verse.verse.unicode;
                const vishraam = verse.visraam;
                const originalVerse = verse.verse.unicode;

                const globalIndex = shabad.startIndex + verseIndex + 1;

                return (
                  <ParagraphTextForPath
                    key={`${verse.verseId}-${verseIndex}`}
                    gurbaniLine={gurbaniLine}
                    onSelection={createSelectionHandler(verseIndex, verse.verseId)}
                    onSave={createSaveHandler(verse.verseId)}
                    onLayout={createParagraphVerseLayoutHandler(verse.verseId, shabadIndex)}
                    isSaving={isSaving}
                    pressIndex={pressIndex}
                    index={globalIndex}
                    verseId={verse.verseId}
                    savedPathVerseId={savedPathVerseId}
                    setIsSaving={setIsSaving}
                    setIsSaved={setIsSaved}
                    setPressIndex={setPressIndex}
                    setSavedPathVerseId={setSavedPathVerseId}
                    found={found}
                    setFound={setFound}
                    fontSize={fontSize}
                    isSaved={isSaved}
                    isVishraam={isVishraam}
                    vishraams={vishraam}
                    vishraamsSource={vishraamsSource}
                    vishraamsStyle={vishraamsStyle}
                    originalVerse={originalVerse}
                  />
                );
              })}
            </View>
          ))}
        </View>
      );
    }
    return pathContent?.page?.map((path: Verse, index: number) => {
      const gurbaniLine = isLarivaar ? path.larivaar.unicode : path.verse.unicode;
      const vishraam = path.visraam;
      const originalVerse = path.verse.unicode;

      return (
        <SimpleTextForPath
          key={`${path.verseId}-${index}`}
          gurbaniLine={gurbaniLine}
          onSelection={createSelectionHandler(index, path.verseId)}
          onSave={createSaveHandler(path.verseId)}
          onLayout={createLayoutHandler(path.verseId)}
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
          fontSize={fontSize}
          isSaved={isSaved}
          isVishraam={isVishraam}
          vishraams={vishraam}
          vishraamsSource={vishraamsSource}
          vishraamsStyle={vishraamsStyle}
          originalVerse={originalVerse}
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
    createLayoutHandler,
    createParagraphVerseLayoutHandler,
    createShabadLayoutHandler,
    setIsSaving,
    setIsSaved,
    setPressIndex,
    setSavedPathVerseId,
    found,
    setFound,
    fontSize,
    isSaved,
    isParagraphMode,
    shabadsWithIndices,
    isVishraam,
    vishraamsSource,
    vishraamsStyle,
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
        onScrollBeginDrag={() => {
          scrolledToSavedPath.current = true;
          setFound(false);
        }}
        onScrollEndDrag={() => {
          onScrollEndDrag?.(scrollOffset.current);
        }}
        onMomentumScrollEnd={() => {
          onScrollEndDrag?.(scrollOffset.current);
        }}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={() => false}
        removeClippedSubviews={true}
        onLayout={handleViewportLayout}
      >
        {pageContent}
        {pathContent?.source?.pageNo < PATH_DATA.LAST_ANG_NUMBER && !isNavigating && (
          <PathNextAng pathAng={pathContent?.source?.pageNo} handleRightArrow={handleAngChange} />
        )}
      </ScrollView>
    </GestureRecognizer>
  );
};

export const PathReader = React.memo(PathReaderComponent);
