import React, { useRef, useEffect } from 'react';
import { Text } from 'react-native';
import { SaveIcon } from '@icons';
import { UIConstants } from '@constants';
import {
  PathTextProps,
  useIsSelected,
  useAccessibilityLabel,
  useTextStyle,
  createLongPressHandler,
  pathTextPropsAreEqual,
} from '@utils';
import { VishraamsText } from './VishraamsText';

type ParagraphTextForPathProps = PathTextProps & {
  onTextLayout?: (event: any) => void;
};

const ParagraphTextForPathComponent = ({
  gurbaniLine,
  renderWordSegments,
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
  isVishraam,
  vishraams,
  vishraamsSource,
  onLayout,
  onTextLayout,
}: ParagraphTextForPathProps) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressLock = useRef(false);
  const didLongPress = useRef(false);

  const isSelected = useIsSelected(verseId, savedPathVerseId, isSaving, pressIndex, index);
  const accessibilityLabel = useAccessibilityLabel(index, isSelected);
  const textStyle = useTextStyle(fontSize);
  const selectedTextStyle = isSelected
    ? { backgroundColor: UIConstants.PATH_SELECTED_BACKGROUND_COLOR }
    : undefined;

  const baseLongPressHandler = createLongPressHandler(
    index,
    verseId,
    found,
    onSave,
    onSelection,
    setFound,
    setPressIndex,
    setSavedPathVerseId,
    setIsSaving,
    setIsSaved
  );

  const handleLongPress = () => {
    // Block duplicate triggers
    if (longPressLock.current) {
      return;
    }

    longPressLock.current = true;
    didLongPress.current = true;

    baseLongPressHandler();

    // Unlock after delay
    timeoutRef.current = setTimeout(() => {
      longPressLock.current = false;
    }, 600);
  };

  const handlePress = () => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    if (isSaving) {
      onSelection();
      onSave();
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return (
    <Text
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onLongPress={handleLongPress}
      accessibilityHint="Tap to select, long press to save this line"
      disabled={isSaved || found}
      suppressHighlighting={true}
      style={textStyle}
      onLayout={onLayout}
      onTextLayout={onTextLayout}
    >
      <Text style={selectedTextStyle}>
        {isVishraam ? (
          <VishraamsText
            gurbaniLine={gurbaniLine}
            renderWordSegments={renderWordSegments}
            vishraams={vishraams}
            vishraamsSource={vishraamsSource}
          />
        ) : (
          gurbaniLine
        )}{' '}
      </Text>
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

export const ParagraphTextForPath = React.memo(
  ParagraphTextForPathComponent,
  (prevProps, nextProps) =>
    pathTextPropsAreEqual(prevProps, nextProps) && prevProps.onTextLayout === nextProps.onTextLayout
);
