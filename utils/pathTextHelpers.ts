import { useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { SimpleTextForPathStyles } from '@styles';
import type { PathSelection } from '@components/PathSelectionContext';
import type { Visraams } from '../types';

/**
 * Common props interface for path text components
 */
/**
 * Per-verse props only.
 *
 * Selection/save state comes from PathSelectionContext and display settings
 * come from the Redux store, so neither is drilled through here any more.
 */
export interface PathTextProps {
  gurbaniLine: string;
  renderWordSegments?: string[] | null;
  index: number;
  verseId: number;
  /** Vishraam markers for THIS verse (per-verse data, not a setting). */
  vishraams: Visraams;
  onSelection: () => void;
  onSave: () => void;
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

export type LarivaarRenderData = {
  displayText: string;
  wordSegments: string[] | null;
};

const ZERO_WIDTH_SPACE = '\u200B';

const splitWords = (text?: string): string[] =>
  text ? text.trim().split(/\s+/).filter(Boolean) : [];

export const getLarivaarRenderData = (
  larivaar: string,
  originalVerse?: string
): LarivaarRenderData => {
  const originalWords = splitWords(originalVerse);
  const collapsedOriginal = originalWords.join('');

  if (originalWords.length > 1 && collapsedOriginal === larivaar) {
    return {
      displayText: originalWords.join(ZERO_WIDTH_SPACE),
      wordSegments: originalWords,
    };
  }

  return {
    displayText: larivaar,
    wordSegments: null,
  };
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
 * Creates a long press handler that saves the verse.
 *
 * The selection state it mutates now comes from PathSelectionContext, so this
 * takes 3 arguments instead of the previous 10.
 */
export const createLongPressHandler = (
  index: number,
  verseId: number,
  selection: PathSelection,
  onSave: () => void,
  onSelection: () => void
) => {
  return () => {
    if (selection.found) {
      selection.setFound(false);
    }

    // Highlight the verse and enter saving mode, but do NOT claim it is saved
    // yet: `isSaved` is only set once the write is durable (in the save handler).
    unstable_batchedUpdates(() => {
      selection.setPressIndex(index);
      selection.setSavedPathVerseId(verseId);
      selection.setIsSaving(true);
      selection.setIsSaved(false);
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
/**
 * Only per-verse props are compared. Selection state and display settings now
 * come from context/store, which re-render subscribers on their own.
 */
export const pathTextPropsAreEqual = (prevProps: PathTextProps, nextProps: PathTextProps) => {
  return (
    prevProps.gurbaniLine === nextProps.gurbaniLine &&
    prevProps.renderWordSegments === nextProps.renderWordSegments &&
    prevProps.index === nextProps.index &&
    prevProps.verseId === nextProps.verseId &&
    prevProps.vishraams === nextProps.vishraams &&
    prevProps.onLayout === nextProps.onLayout
  );
};
