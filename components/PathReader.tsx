import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { ScrollView, Text, View } from 'react-native';
import { ParagraphTextForPath, SimpleTextForPath } from '@components';
import { PathReaderStyles } from '@styles';
import { PathNextAng } from './PathNextAng';
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
  setIsAngNavigation: (value: boolean) => void;
  isVishraam: boolean;
  vishraamsSource: string;
  vishraamsStyle: string;
  onSaveCommit?: (angNumber: number, verseId: number) => void;
  setCenterVerseId?: (verseId: number) => void;
  scrollToVerseId?: number;
  onAnyScroll?: () => void;
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
  setIsAngNavigation,
  isVishraam,
  vishraamsSource,
  vishraamsStyle,
  onSaveCommit,
  setCenterVerseId,
  scrollToVerseId,
  onAnyScroll,
  onScrollEndDrag,
}: PathReaderProps) => {
  const viewportHeight = useRef<number>(0);
  const versePositions = useRef<Map<number, { y: number; height: number }>>(new Map());
  const hasScrolledToVerse = useRef<boolean>(false);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserDraggingRef = useRef<boolean>(false);

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

  const findCenterVerseId = useCallback(
    (scrollY: number) => {
      if (!setCenterVerseId) {
        return;
      }

      // Wait for verses to be measured
      if (versePositions.current.size === 0) {
        return;
      }

      const centerY = scrollY + viewportHeight.current / 2;
      let closestVerseId: number | null = null;
      let minDistance = Infinity;

      versePositions.current.forEach((position, verseId) => {
        const verseCenter = position.y + position.height / 2;
        const distance = Math.abs(verseCenter - centerY);

        if (distance < minDistance) {
          minDistance = distance;
          closestVerseId = verseId;
        }
      });

      if (closestVerseId !== null) {
        setCenterVerseId(closestVerseId);
      }
    },
    [setCenterVerseId]
  );

  const handleScroll = useCallback(
    (e: any) => {
      const scrollY = e.nativeEvent.contentOffset.y;
      scrollOffset.current = scrollY;

      if (isUserDraggingRef.current) {
        if (onAnyScroll) {
          onAnyScroll();
        }
      }

      // Clear existing timer
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }

      // Set new timer to detect when scrolling stops
      scrollEndTimer.current = setTimeout(() => {
        findCenterVerseId(scrollY);
      }, 150); // Wait 150ms after scrolling stops

      if (!isAngNavigation) {
        debouncedScrollSave();
      }
    },
    [
      isAngNavigation,
      debouncedScrollSave,
      scrollOffset,
      findCenterVerseId,
      onAnyScroll,
      savedPathVerseId,
      setCenterVerseId,
    ]
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
        (value: boolean) => {
          setIsSaved(value);
          if (value && isAngNavigation) {
            setIsAngNavigation(false);
          }
        }
      );
      if (saved && onSaveCommit) {
        onSaveCommit(pathContent?.source?.pageNo ?? 0, verseId);
      }
    },
    [
      pathId,
      pathContent?.source?.pageNo,
      scrollOffset,
      handleUpdatePathWithErrorHandling,
      setIsSaved,
      isAngNavigation,
      setIsAngNavigation,
      onSaveCommit,
    ]
  );

  const createLayoutHandler = useCallback(
    (verseId: number) => (event: any) => {
      const { y, height } = event.nativeEvent.layout;
      versePositions.current.set(verseId, { y, height });

      // If we're waiting to scroll to this verse, do it now
      if (
        scrollToVerseId === verseId &&
        !hasScrolledToVerse.current &&
        scrollRef.current &&
        viewportHeight.current > 0
      ) {
        const verseY = y;
        const verseCenterY = verseY + height / 2;
        const screenCenterY = viewportHeight.current / 2;
        const targetScroll = Math.max(0, verseCenterY - screenCenterY);

        // Scroll immediately without delay to prevent verse from jumping
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            y: targetScroll,
            animated: false,
          });
          scrollOffset.current = targetScroll;
          hasScrolledToVerse.current = true;
        }
      }
    },
    [scrollToVerseId, scrollRef, scrollOffset]
  );

  // Clear verse positions when page changes
  useEffect(() => {
    versePositions.current.clear();
    hasScrolledToVerse.current = false;
    if (setCenterVerseId) {
      setCenterVerseId(0);
    }
  }, [pathContent?.source?.pageNo, setCenterVerseId]);

  // Clear verse positions when font size or paragraph mode changes
  useEffect(() => {
    versePositions.current.clear();
    hasScrolledToVerse.current = false;
  }, [fontSize, isParagraphMode]);

  // Reset scroll flag when scrollToVerseId changes
  useEffect(() => {
    if (scrollToVerseId) {
      hasScrolledToVerse.current = false;
    }
  }, [scrollToVerseId]);

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
            <Text
              key={shabadIndex}
              style={{
                marginBottom: 14,
                lineHeight: fontSize * 1.6,
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
            </Text>
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
          isUserDraggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          isUserDraggingRef.current = false;
          onScrollEndDrag?.(scrollOffset.current);
        }}
        onMomentumScrollEnd={() => {
          isUserDraggingRef.current = false;
          onScrollEndDrag?.(scrollOffset.current);
        }}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={() => false}
        removeClippedSubviews={true}
        onLayout={(e) => {
          viewportHeight.current = e.nativeEvent.layout.height;
        }}
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
