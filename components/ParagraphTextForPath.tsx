import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Text, Pressable, Platform, unstable_batchedUpdates } from 'react-native';
import { SaveIcon } from '@icons';
import { SimpleTextForPathStyles } from '@styles';
import { UIConstants } from '@constants';

interface Props {
  gurbaniLine: string;
  onSelection: () => void;
  isSaving: boolean;
  isParagraphMode: boolean;
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
}

const ParagraphTextForPathComponent = ({
  gurbaniLine,
  onSelection,
  isSaving,
  isParagraphMode,
  pressIndex,
  index,
  onSave,
  verseId,
  savedPathVerseId,
  setIsSaved,
  setIsSaving,
  setPressIndex,
  setSavedPathVerseId,
  found,
  setFound,
  fontSize,
  isSaved,
}: Props) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longPressLock = useRef(false);
  const didLongPress = useRef(false);


  const handleLongPress = useCallback(() => {
    // Block duplicate triggers
    if (longPressLock.current) return;
  
    longPressLock.current = true;
    didLongPress.current = true;
  
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
  
    // Unlock after delay
    setTimeout(() => {
      longPressLock.current = false;
    }, 600);
  }, [
    index,
    verseId,
    found,
    onSave,
    onSelection,
    setFound,
    setPressIndex,
    setSavedPathVerseId,
    setIsSaving,
    setIsSaved,
  ]);
  

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const isSelected = useMemo(
    () => verseId === savedPathVerseId || (isSaving && pressIndex === index),
    [verseId, savedPathVerseId, isSaving, pressIndex, index]
  );

  const accessibilityLabel = useMemo(
    () => `Gurbani line ${index + 1}${isSelected ? ', selected' : ''}`,
    [index, isSelected]
  );

  const textStyle = useMemo(
    () => ({
      ...SimpleTextForPathStyles.text,
      fontSize,
      lineHeight: fontSize * 2.2,
    }),
    [fontSize]
  );

  const containerStyle = useMemo(
    () => (isSelected ? SimpleTextForPathStyles.coloredContainer : undefined),
    [isSelected]
  );

  return (
    <Text
    onPress={() => {
        if (didLongPress.current) {
            didLongPress.current = false;
            return;
          }
        if (isSaving) {
          onSelection();
          onSave();
        }
      }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onLongPress={handleLongPress}
      accessibilityHint="Tap to select, long press to save this line"
      disabled={isSaved || found}
      suppressHighlighting={true}
      style={[textStyle, containerStyle]}
      >
      {gurbaniLine + " "}
        {isSelected && (
        <Text>
          <SaveIcon
            color={UIConstants.SAVE_ICON_COLOR}
            width={fontSize * 1.2}
            height={fontSize * 1.2}
            style={{ transform: [{ translateY: fontSize * 0.2 }] }}
          />
        </Text>
        )}
      </Text>
  );
};

export const ParagraphTextForPath = React.memo(ParagraphTextForPathComponent, (prevProps, nextProps) => {
  return (
    prevProps.gurbaniLine === nextProps.gurbaniLine &&
    prevProps.isSaving === nextProps.isSaving &&
    prevProps.isParagraphMode === nextProps.isParagraphMode &&
    prevProps.pressIndex === nextProps.pressIndex &&
    prevProps.index === nextProps.index &&
    prevProps.verseId === nextProps.verseId &&
    prevProps.savedPathVerseId === nextProps.savedPathVerseId &&
    prevProps.found === nextProps.found &&
    prevProps.fontSize === nextProps.fontSize
  );
});
