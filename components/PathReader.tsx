import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { ScrollView, Text, View } from 'react-native';
import { ParagraphTextForPath, SimpleTextForPath } from '@components';
import { PathReaderStyles } from '@styles';
import { PathNextAng } from './PathNextAng';
import { trackEvent } from '@utils/analytics';

interface PathReaderProps {
  pathContent: any;
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
  setCenterVerseId?: (verseId: number) => void;
  scrollToVerseId?: number;
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
  setCenterVerseId,
  scrollToVerseId,
}: PathReaderProps) => {
  const viewportHeight = useRef<number>(0);
  const versePositions = useRef<Map<number, { y: number; height: number }>>(new Map());
  const hasScrolledToVerse = useRef<boolean>(false);

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

  const findCenterVerseId = useCallback((scrollY: number) => {
    if (!setCenterVerseId) return;
    
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
  }, [setCenterVerseId]);


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

  const createLayoutHandler = useCallback(
    (verseId: number) => (event: any) => {
      const { y, height } = event.nativeEvent.layout;
      versePositions.current.set(verseId, { y, height });
      
      // If we're waiting to scroll to this verse, do it now
      if (scrollToVerseId === verseId && !hasScrolledToVerse.current && scrollRef.current && viewportHeight.current > 0) {
        const verseY = y;
        const verseCenterY = verseY + height / 2;
        const screenCenterY = viewportHeight.current / 2;
        const targetScroll = Math.max(0, verseCenterY - screenCenterY);
        
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTo({
                y: targetScroll,
                animated: false,
              });
              scrollOffset.current = targetScroll;
              hasScrolledToVerse.current = true;
            }
          }, 100);
        });
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

  // Reset scroll flag when scrollToVerseId changes
  useEffect(() => {
    if (scrollToVerseId) {
      hasScrolledToVerse.current = false;
    }
  }, [scrollToVerseId]);

  const groupedByShabad = useMemo(() => {
    if (!pathContent?.page) return [];
  
    return Object.values(
      pathContent.page.reduce((acc: any, item: any) => {
        if (!acc[item.shabadId]) acc[item.shabadId] = [];
        acc[item.shabadId].push(item);
        return acc;
      }, {})
    );
  }, [pathContent?.page]);
  

  const pageContent = useMemo(() => {
    if(isParagraphMode){
      let globalIndex = 0;
      return (
        <View>
          {groupedByShabad.map((shabad: any, sIndex) => {
            // For paragraph mode, track ALL verses in the shabad
            // Map each verse to this shabad's position
            const shabadLayoutHandler = (event: any) => {
              const { y, height } = event.nativeEvent.layout;
              // Store position for all verses in this shabad
              shabad.forEach((path: any) => {
                versePositions.current.set(path.verseId, { y, height });
              });
              
              // Check if we need to scroll to any verse in this shabad
              if (scrollToVerseId && shabad.some((p: any) => p.verseId === scrollToVerseId) && !hasScrolledToVerse.current && scrollRef.current && viewportHeight.current > 0) {
                const shabadCenterY = y + height / 2;
                const screenCenterY = viewportHeight.current / 2;
                const targetScroll = Math.max(0, shabadCenterY - screenCenterY);
                
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollTo({
                        y: targetScroll,
                        animated: false,
                      });
                      scrollOffset.current = targetScroll;
                      hasScrolledToVerse.current = true;
                    }
                  }, 100);
                });
              }
            };
            
            return (
              <View 
                key={sIndex} 
                onLayout={shabadLayoutHandler}
              >
                <Text
                  style={{
                    marginBottom: 14,
                    lineHeight: fontSize * 1.6,
                  }}
                >
                  {shabad.map((path: any, index: any) => {
                    const gurbaniLine = isLarivaar
                      ? path.larivaar.unicode
                      : path.verse.unicode;

                    const currentGlobalIndex = globalIndex++;
        
                    return (
                      <ParagraphTextForPath
                        key={`${path.verseId}-${index}`}
                        gurbaniLine={gurbaniLine}
                        onSelection={createSelectionHandler(index, path.verseId)}
                        onSave={createSaveHandler(path.verseId)}
                        onLayout={() => {}}
                        isSaving={isSaving}
                        isParagraphMode={isParagraphMode}
                        pressIndex={pressIndex}
                        index={currentGlobalIndex + 1}
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
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      ); 
    }
    return pathContent?.page?.map((path: any, index: number) => {
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
    groupedByShabad,
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
        {pathContent?.source?.pageNo < 1430 && !isNavigating && (
          <PathNextAng pathAng={pathContent?.source?.pageNo} handleRightArrow={handleAngChange} />
        )}
      </ScrollView>
    </GestureRecognizer>
  );
};

export const PathReader = React.memo(PathReaderComponent);
