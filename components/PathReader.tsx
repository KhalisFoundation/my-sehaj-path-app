import React, { useCallback, useMemo } from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { ScrollView, Text, View } from 'react-native';
import { ParagraphTextForPath, SimpleTextForPath } from '@components';
import { PathReaderStyles } from '@styles';
import { PathNextAng } from './PathNextAng';
import { trackEvent } from '@utils/analytics';
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
  isVishraam: boolean;
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

  const shabadsWithIndices = useMemo(() => {
    if (!pathContent?.page) return [];
  
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
    if(isParagraphMode){
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
                const gurbaniLine = isLarivaar
                  ? verse.larivaar.unicode
                  : verse.verse.unicode;
                const vishraam = verse.visraam;

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
                    vishraam={vishraam}
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
          fontSize={fontSize}
          isSaved={isSaved}
          isVishraam={isVishraam}
          vishraam={vishraam}
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
