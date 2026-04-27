import { useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { SimpleTextForPathStyles } from '@styles';
import { Visraams } from '@hooks/useLocal';

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
 * Comparison function for React.memo to prevent unnecessary re-renders
 */
export const pathTextPropsAreEqual = (prevProps: PathTextProps, nextProps: PathTextProps) => {
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
    prevProps.vishraamsStyle === nextProps.vishraamsStyle &&
    prevProps.onLayout === nextProps.onLayout
  );
};
