import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { Text, Pressable, Platform, unstable_batchedUpdates } from 'react-native';
import { SaveIcon } from '@icons';
import { SimpleTextForPathStyles } from '@styles';
import { UIConstants } from '@constants';

interface Props {
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
}

const SimpleTextForPathComponent = ({
  gurbaniLine,
  onSelection,
  isSaving,
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
  const isLongPressingRef = useRef<boolean>(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPress = useCallback(() => {
    if (isLongPressingRef.current) {
      return;
    }
    isLongPressingRef.current = true;
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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    isLongPressingRef.current = false;
    timeoutRef.current = null;
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
    <Pressable
      onPress={() => {
        if (isSaving) {
          onSelection();
          onSave();
        }
      }}
      style={containerStyle}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onLongPress={handleLongPress}
      delayLongPress={Platform.OS === 'ios' ? 350 : 500}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      accessibilityHint="Tap to select, long press to save this line"
      disabled={isSaved}
    >
      <Text suppressHighlighting={true} style={textStyle}>
        {gurbaniLine}
        {isSelected && (
          <SaveIcon
            color={UIConstants.SAVE_ICON_COLOR}
            width={fontSize * 1.2}
            height={fontSize * 1.2}
            style={{ transform: [{ translateY: fontSize * 0.2 }] }}
          />
        )}
      </Text>
    </Pressable>
  );
};

export const SimpleTextForPath = React.memo(SimpleTextForPathComponent, (prevProps, nextProps) => {
  return (
    prevProps.gurbaniLine === nextProps.gurbaniLine &&
    prevProps.isSaving === nextProps.isSaving &&
    prevProps.pressIndex === nextProps.pressIndex &&
    prevProps.index === nextProps.index &&
    prevProps.verseId === nextProps.verseId &&
    prevProps.savedPathVerseId === nextProps.savedPathVerseId &&
    prevProps.found === nextProps.found &&
    prevProps.fontSize === nextProps.fontSize
  );
});
