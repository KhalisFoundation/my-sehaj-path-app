import React from 'react';
import GestureRecognizer from 'react-native-swipe-gestures';
import { ScrollView } from 'react-native';
import { SimpleTextForPath } from '@components';
import { PathReaderStyles } from '@styles';

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
  handleStopAutoScroll: () => void;
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
}

export const PathReader = ({
  pathContent,
  isLarivaar,
  isSaving,
  pressIndex,
  savedPathVerseId,
  scrollRef,
  scorllOffset,
  isAngNavigation,
  debouncedScrollSave,
  handleStopAutoScroll,
  handleRightArrow,
  handleLeftArrow,
  setPressIndex,
  setSavedPathVerseId,
  handleUpdatePath,
  setIsSaving,
  setIsSaved,
  pathId,
}: PathReaderProps) => {
  return (
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
        onTouchStart={() => handleStopAutoScroll()}
        scrollEventThrottle={16}
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
            />
          );
        })}
      </ScrollView>
    </GestureRecognizer>
  );
};
