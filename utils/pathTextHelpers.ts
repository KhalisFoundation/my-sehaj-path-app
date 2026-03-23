import { useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { SimpleTextForPathStyles } from '@styles';
import { VishraamsMarker, Visraams } from '@hooks/useLocal';
import { VishraamsTheme } from '@constants/VishraamsTheme';
import React from 'react';
import { Text } from 'react-native';

/**
 * Common props interface for path text components
 */
export interface PathTextProps {
  gurbaniLine: string;
  onSelection: () => void;
  isSaving: boolean;
  pressIndex: number;
  index: number;
  onSave: () => void;
  verseId: number;
  savedPathVerseId: number;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  setPressIndex: (value: number) => void;
  setSavedPathVerseId: (value: number) => void;
  found: boolean;
  setFound: (value: boolean) => void;
  fontSize: number;
  isSaved: boolean;
  isVishraam: boolean;
  vishraams: Visraams;
  vishraamsSource?: string;
  vishraamsStyle?: string;
  originalVerse?: string;
  onLayout?: (event: any) => void;
}

/**
 * Hook to determine if the current verse is selected
 */
export const useIsSelected = (
  verseId: number,
  savedPathVerseId: number,
  isSaving: boolean,
  pressIndex: number,
  index: number
) => {
  return useMemo(
    () => verseId === savedPathVerseId || (isSaving && pressIndex === index),
    [verseId, savedPathVerseId, isSaving, pressIndex, index]
  );
};

/**
 * Hook to generate accessibility label
 */
export const useAccessibilityLabel = (index: number, isSelected: boolean) => {
  return useMemo(
    () => `Gurbani line ${index + 1}${isSelected ? ', selected' : ''}`,
    [index, isSelected]
  );
};

/**
 * Hook to generate text style with dynamic font size
 */
export const useTextStyle = (fontSize: number) => {
  return useMemo(
    () => ({
      ...SimpleTextForPathStyles.text,
      fontSize,
      lineHeight: fontSize * 2.2,
    }),
    [fontSize]
  );
};

/**
 * Hook to generate container style based on selection state
 */
export const useContainerStyle = (isSelected: boolean) => {
  return useMemo(
    () => (isSelected ? SimpleTextForPathStyles.coloredContainer : undefined),
    [isSelected]
  );
};

/**
 * Creates a long press handler that saves the verse
 */
export const createLongPressHandler = (
  index: number,
  verseId: number,
  found: boolean,
  onSave: () => void,
  onSelection: () => void,
  setFound: (value: boolean) => void,
  setPressIndex: (value: number) => void,
  setSavedPathVerseId: (value: number) => void,
  setIsSaving: (value: boolean) => void,
  setIsSaved: (value: boolean) => void
) => {
  return () => {
    if (found) {
      setFound(false);
    }

    unstable_batchedUpdates(() => {
      setPressIndex(index);
      setSavedPathVerseId(verseId);
      setIsSaving(true);
      setIsSaved(true);
    });

    onSelection();
    onSave();
  };
};

/**
 * Creates a press handler for when the verse is already in saving mode
 */
export const createPressHandler = (
  isSaving: boolean,
  onSelection: () => void,
  onSave: () => void
) => {
  return () => {
    if (isSaving) {
      onSelection();
      onSave();
    }
  };
};

/**
 * Processes Gurbani text and renders with vishraam styling
 * Note: The position 'p' in vishraam data represents the word index (0-based)
 * Vishraams are applied to the entire word at position p
 * @param gurbaniLine - The Gurbani text (can be spaced or Larivaar)
 * @param vishraam - Vishraam data containing marker positions
 * @param fontSize - Font size for styling
 * @param vishraamsSource - Selected vishraam source ('sttm', 'igurbani', or 'sttm2')
 * @param vishraamsStyle - Selected vishraam style ('colored-words' or 'gradient-bg')
 * @param originalVerse - The original spaced verse (needed for Larivaar mode)
 * @returns Array of React elements with vishraam styling applied to words
 */
export const renderTextWithVishraams = (
  gurbaniLine: string,
  vishraams: Visraams,
  fontSize: number,
  vishraamsSource: string = 'sttm',
  originalVerse?: string
): React.ReactElement[] => {
  // Use the selected vishraam source
  const vishraamsData = vishraams?.[vishraamsSource as keyof Visraams] || [];
  
  if (!vishraamsData || vishraamsData.length === 0) {
    return [React.createElement(Text, { key: 0 }, gurbaniLine)];
  }

  // Check if this is Larivaar mode (no spaces in the text)
  const isLarivaar = !gurbaniLine.includes(' ');
  
  // For Larivaar, we need the original spaced verse to map word positions
  const referenceText = isLarivaar && originalVerse ? originalVerse : gurbaniLine;
  const words = referenceText.split(' ').filter(w => w.length > 0);
  const elements: React.ReactElement[] = [];
  
  // For Larivaar mode, build character position mapping
  if (isLarivaar && originalVerse) {
    let larivaarPos = 0;
    
    words.forEach((word, wordIndex) => {
      const marker = vishraamsData.find((v: VishraamsMarker) => v.p === wordIndex);
      const wordLength = word.length;
      const wordText = gurbaniLine.substring(larivaarPos, larivaarPos + wordLength);
      
      if (marker) {
        const isMainPause = marker.t === 'v';
        const pauseConfig = isMainPause ? VishraamsTheme.mainPause : VishraamsTheme.lightPause;
          elements.push(
            React.createElement(
              Text,
              {
                key: `word-${wordIndex}`,
                style: {
                  color: pauseConfig.text,
                  fontWeight: VishraamsTheme.coloredWords.fontWeight,
                },
              },
              wordText
            )
          );
      } else {
        elements.push(
          React.createElement(Text, { key: `word-${wordIndex}` }, wordText)
        );
      }
      
      larivaarPos += wordLength;
    });
    
    return elements;
  }
  
  // Regular spaced text mode

  words.forEach((word, wordIndex) => {
    // Check if there's a vishraam marker at this word position (0-based)
    const marker = vishraamsData.find((v: VishraamsMarker) => v.p === wordIndex);
    
    if (marker) {
      // Apply vishraam styling based on selected style
      const isMainPause = marker.t === 'v';
      const pauseConfig = isMainPause ? VishraamsTheme.mainPause : VishraamsTheme.lightPause;
        // Colored words style (default)
        elements.push(
          React.createElement(
            Text,
            {
              key: `word-${wordIndex}`,
              style: {
                color: pauseConfig.text,
                fontWeight: VishraamsTheme.coloredWords.fontWeight,
              },
            },
            word
          )
        );
    } else {
      // Regular word without vishraam
      elements.push(
        React.createElement(Text, { key: `word-${wordIndex}` }, word)
      );
    }

    // Add space after word (except for last word)
    if (wordIndex < words.length - 1) {
      elements.push(React.createElement(Text, { key: `space-${wordIndex}` }, ' '));
    }
  });

  return elements;
};

/**
 * Comparison function for React.memo to prevent unnecessary re-renders
 */
export const pathTextPropsAreEqual = (
  prevProps: PathTextProps,
  nextProps: PathTextProps
) => {
  return (
    prevProps.gurbaniLine === nextProps.gurbaniLine &&
    prevProps.isSaving === nextProps.isSaving &&
    prevProps.pressIndex === nextProps.pressIndex &&
    prevProps.index === nextProps.index &&
    prevProps.verseId === nextProps.verseId &&
    prevProps.savedPathVerseId === nextProps.savedPathVerseId &&
    prevProps.found === nextProps.found &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.isVishraam === nextProps.isVishraam &&
    prevProps.vishraamsSource === nextProps.vishraamsSource &&
    prevProps.vishraamsStyle === nextProps.vishraamsStyle
  );
};
