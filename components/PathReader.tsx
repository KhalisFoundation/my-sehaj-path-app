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
  ) => void;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  pathId: number;
  isNavigating: boolean;
  found: boolean;
  setFound: (value: boolean) => void;
  fontSize: number;
  isSaved: boolean;
  setIsAngNavigation: (value: boolean) => void;
  setCenterVerseId?: (verseId: number) => void;
  scrollToVerseId?: number;
  onUserScroll?: (scrollY: number, centerVerseId: number) => boolean;
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
  setCenterVerseId,
  scrollToVerseId,
  onUserScroll,
}: PathReaderProps) => {
  const viewportHeight = useRef<number>(0);
  const versePositions = useRef<Map<number, { y: number; height: number }>>(new Map());
  const hasScrolledToVerse = useRef<boolean>(false);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const getCenterVerseId = useCallback(
    (scrollY: number): number | null => {
      if (!setCenterVerseId) {
        return null;
      }

      const centerY = scrollY + viewportHeight.current / 2;

      // If verses are measured (non-paragraph mode), use precise positions.
      if (versePositions.current.size > 0) {
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

        return closestVerseId;
      }

      // Paragraph mode fallback: approximate by scroll height.
      if (pathContent?.page?.length) {
        let scrollHeight;
        if (fontSize <= 18) {
          scrollHeight = 25;
        } else if (fontSize <= 24) {
          scrollHeight = 50;
        } else if (fontSize <= 30) {
          scrollHeight = 100;
        } else {
          scrollHeight = 150;
        }
        const approxIndex = Math.max(
          0,
          Math.min(pathContent.page.length - 1, Math.round(centerY / scrollHeight))
        );
        const verseId = pathContent.page[approxIndex]?.verseId;
        if (verseId) {
          return verseId;
        }
      }
      return null;
    },
    [setCenterVerseId, pathContent?.page, fontSize]
  );

  const handleScroll = useCallback(
    (e: any) => {
      const scrollY = e.nativeEvent.contentOffset.y;
      scrollOffset.current = scrollY;

      // Clear existing timer
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }

      // Set new timer to detect when scrolling stops
      scrollEndTimer.current = setTimeout(() => {
        const centerVerseId = getCenterVerseId(scrollY);
        if (centerVerseId && setCenterVerseId) {
          setCenterVerseId(centerVerseId);
        }
      }, 150); // Wait 150ms after scrolling stops

      const immediateCenterVerseId = getCenterVerseId(scrollY) || 0;
      if (immediateCenterVerseId && setCenterVerseId) {
        setCenterVerseId(immediateCenterVerseId);
      }
      const handledByParent = onUserScroll ? onUserScroll(scrollY, immediateCenterVerseId) : false;

      if (!handledByParent && !isAngNavigation) {
        debouncedScrollSave();
      }
    },
    [
      scrollOffset,
      onUserScroll,
      isAngNavigation,
      getCenterVerseId,
      debouncedScrollSave,
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
    (verseId: number) => () => {
      handleUpdatePathWithErrorHandling(
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
    },
    [
      pathId,
      pathContent?.source?.pageNo,
      scrollOffset,
      handleUpdatePathWithErrorHandling,
      setIsSaved,
      isAngNavigation,
      setIsAngNavigation,
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
