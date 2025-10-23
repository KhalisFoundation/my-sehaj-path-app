import React from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { SafeAreaView, ScrollView } from 'react-native';
import { SimpleTextForPath } from '@components';
import { PathReaderStyles, SafeAreaStyle } from '@styles';
import { PathNextAng } from './PathNextAng';
import { trackAngsByBottomNavEvent } from '@utils/analytics';

interface PathReaderProps {
  pathContent: any;
  isLarivaar: boolean;
  isSaving: boolean;
  pressIndex: number;
  savedPathVerseId: number;
  scrollRef: React.RefObject<ScrollView>;
  scorllOffset: React.MutableRefObject<number>;
  isAngNavigation: boolean;
  debouncedScrollSave: () => void;
  handleRightArrow: (pageNo: number) => void;
  handleLeftArrow: (pageNo: number) => void;
  setPressIndex: (index: number) => void;
  setSavedPathVerseId: (verseId: number) => void;
  handleUpdatePath: (
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

export const PathReader = React.memo(
  ({
    pathContent,
    isLarivaar,
    isSaving,
    pressIndex,
    savedPathVerseId,
    scrollRef,
    scorllOffset,
    isAngNavigation,
    debouncedScrollSave,
    handleRightArrow,
    handleLeftArrow,
    setPressIndex,
    setSavedPathVerseId,
    handleUpdatePath,
    setIsSaving,
    setIsSaved,
    pathId,
    isNavigating,
    found,
    setFound,
  }: PathReaderProps) => {
    const handleAngChange = () => {
      trackAngsByBottomNavEvent('click', 'next ang from bottom nav');
      handleRightArrow(pathContent?.source?.pageNo);
    };

    return (
      <SafeAreaView style={SafeAreaStyle.safeAreaView}>
        <GestureRecognizer
          onSwipeLeft={() => handleRightArrow(pathContent?.source?.pageNo)}
          onSwipeRight={() => handleLeftArrow(pathContent?.source?.pageNo)}
          onSwipeDown={() => undefined}
          onSwipeUp={() => undefined}
          config={{
            velocityThreshold: 0.8,
            directionalOffsetThreshold: 80,
            gestureIsClickThreshold: 10,
          }}
        >
          <ScrollView
            contentContainerStyle={PathReaderStyles.pathContentContainer}
            ref={scrollRef}
            onScroll={(e) => {
              const scrollY = e.nativeEvent.contentOffset.y;
              scorllOffset.current = scrollY;
              if (!isAngNavigation) {
                debouncedScrollSave();
              }
            }}
            scrollEventThrottle={16}
            decelerationRate="fast"
          >
            {pathContent?.page?.map((path: any, index: number) => {
              return (
                <SimpleTextForPath
                  key={index}
                  gurbaniLine={isLarivaar ? path.larivaar.unicode : path.verse.unicode}
                  onSelection={() => {
                    if (isSaving) {
                      setPressIndex(index + 1);
                      setSavedPathVerseId(path.verseId);
                    }
                  }}
                  onSave={() =>
                    handleUpdatePath(
                      pathId,
                      path.pageNo,
                      path.verseId,
                      scorllOffset.current,
                      setIsSaved
                    )
                  }
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
            })}
            {pathContent?.source?.pageNo < 1430 && !isNavigating && (
              <PathNextAng
                pathAng={pathContent?.source?.pageNo}
                handleRightArrow={handleAngChange}
              />
            )}
          </ScrollView>
        </GestureRecognizer>
      </SafeAreaView>
    );
  }
);
