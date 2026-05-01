import React, { useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { ScrollView, Text, View } from 'react-native';
import { ParagraphTextForPath, SimpleTextForPath } from '@components';
import { PathReaderStyles } from '@styles';
import { PathNextAng } from './PathNextAng';
import { usePathReaderCentering } from './usePathReaderCentering';
import { trackEvent } from '@utils/analytics';
import { getLarivaarRenderData, type LarivaarRenderData } from '@utils';
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
  onContentSizeChange?: (width: number, height: number) => void;
}

type ParagraphVerseRender = {
  verse: Verse;
  renderedText: string;
  renderWordSegments: string[] | null;
};

type ParagraphShabadRender = {
  startIndex: number;
  verses: ParagraphVerseRender[];
};

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
  onContentSizeChange,
}: PathReaderProps) => {
  const {
    clearMeasuredVerses,
    createLayoutHandler,
    createParagraphVerseLayoutHandler,
    createParagraphVerseTextLayoutHandler,
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

  const paragraphShabads = useMemo<ParagraphShabadRender[]>(() => {
    if (!isParagraphMode) {
      return [];
    }

    // Paragraph mode needs one prepared render model that both the visible
    // text and the centering/layout code can share. Without that, larivaar
    // wrapping, Vishraam segmentation, and measured verse positions can drift.
    return shabadsWithIndices.map((shabad) => ({
      startIndex: shabad.startIndex,
      verses: shabad.verses.map((verse) => {
        if (!isLarivaar) {
          return {
            verse,
            renderedText: verse.verse.unicode,
            renderWordSegments: null,
          };
        }

        const renderData: LarivaarRenderData = getLarivaarRenderData(
          verse.larivaar.unicode,
          verse.verse.unicode
        );

        return {
          verse,
          renderedText: renderData.displayText,
          renderWordSegments: renderData.wordSegments,
        };
      }),
    }));
  }, [isParagraphMode, isLarivaar, shabadsWithIndices]);

  const paragraphShabadTextStyle = useMemo(
    () => ({
      marginBottom: 14,
      lineHeight: fontSize * 1.6,
    }),
    [fontSize]
  );

  const pageContent = useMemo(() => {
    if (isParagraphMode) {
      return (
        <View>
          {paragraphShabads.map((shabad, shabadIndex) => (
            <Text
              key={shabadIndex}
              onLayout={createShabadLayoutHandler(shabadIndex)}
              // Measure the full rendered paragraph flow once, then derive each
              // verse's vertical range from that shared layout. This is more
              // stable than treating paragraph verses like independent blocks.
              onTextLayout={createParagraphVerseTextLayoutHandler(
                shabadIndex,
                shabad.verses.map(({ verse, renderedText }) => ({
                  verseId: verse.verseId,
                  text: `${renderedText} `,
                }))
              )}
              style={paragraphShabadTextStyle}
            >
              {shabad.verses.map(
                ({ verse, renderedText, renderWordSegments }, verseIndex: number) => {
                  const { verseId, visraam: vishraam } = verse;
                  const globalIndex = shabad.startIndex + verseIndex + 1;

                  return (
                    <ParagraphTextForPath
                      key={`${verseId}-${verseIndex}`}
                      gurbaniLine={renderedText}
                      renderWordSegments={renderWordSegments}
                      onSelection={createSelectionHandler(globalIndex - 1, verseId)}
                      onSave={createSaveHandler(verseId)}
                      onLayout={createParagraphVerseLayoutHandler(verseId, shabadIndex)}
                      isSaving={isSaving}
                      pressIndex={pressIndex}
                      index={globalIndex}
                      verseId={verseId}
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
                    />
                  );
                }
              )}
            </Text>
          ))}
        </View>
      );
    }
    return pathContent?.page?.map((path: Verse, index: number) => {
      // Line mode can render directly from per-verse data because each verse is
      // already its own measurable block.
      const larivaarRenderData = isLarivaar
        ? getLarivaarRenderData(path.larivaar.unicode, path.verse.unicode)
        : null;
      const gurbaniLine = larivaarRenderData?.displayText ?? path.verse.unicode;
      const vishraam = path.visraam;

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
          renderWordSegments={larivaarRenderData?.wordSegments}
          vishraamsSource={vishraamsSource}
          vishraamsStyle={vishraamsStyle}
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
    createParagraphVerseTextLayoutHandler,
    createShabadLayoutHandler,
    setIsSaving,
    setIsSaved,
    setPressIndex,
    setSavedPathVerseId,
    found,
    setFound,
    fontSize,
    paragraphShabadTextStyle,
    isSaved,
    isParagraphMode,
    paragraphShabads,
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
          findCenterVerseId(scrollOffset.current);
          onScrollEndDrag?.(scrollOffset.current);
        }}
        onMomentumScrollEnd={() => {
          findCenterVerseId(scrollOffset.current);
          onScrollEndDrag?.(scrollOffset.current);
        }}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onStartShouldSetResponder={() => false}
        onMoveShouldSetResponder={() => false}
        removeClippedSubviews={true}
        onLayout={handleViewportLayout}
        onContentSizeChange={onContentSizeChange}
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
