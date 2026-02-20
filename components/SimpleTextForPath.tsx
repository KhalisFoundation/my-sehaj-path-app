import React, { useRef } from 'react';
import { Text, Pressable, Platform } from 'react-native';
import { SaveIcon } from '@icons';
import { UIConstants } from '@constants';
import {
  PathTextProps,
  useIsSelected,
  useAccessibilityLabel,
  useTextStyle,
  useContainerStyle,
  createLongPressHandler,
  createPressHandler,
  pathTextPropsAreEqual,
  renderTextWithVishraams,
} from '@utils';

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
  isVishraam,
  vishraam,
  vishraamsSource,
  vishraamsStyle,
  originalVerse,
}: PathTextProps) => {
  const isLongPressingRef = useRef<boolean>(false);

  const isSelected = useIsSelected(verseId, savedPathVerseId, isSaving, pressIndex, index);
  const accessibilityLabel = useAccessibilityLabel(index, isSelected);
  const textStyle = useTextStyle(fontSize);
  const containerStyle = useContainerStyle(isSelected);

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
    if (isLongPressingRef.current) {
      return;
    }
    isLongPressingRef.current = true;
    baseLongPressHandler();
    isLongPressingRef.current = false;
  };

  const handlePress = createPressHandler(isSaving, onSelection, onSave);

  return (
    <Pressable
      onPress={handlePress}
      style={containerStyle}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onLongPress={handleLongPress}
      delayLongPress={Platform.OS === 'ios' ? 350 : 500}
      pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
      accessibilityHint="Tap to select, long press to save this line"
      disabled={isSaved || found}
    >
      <Text suppressHighlighting={true} style={textStyle} >
        {isVishraam ? renderTextWithVishraams(gurbaniLine, vishraam, fontSize, vishraamsSource, vishraamsStyle, originalVerse) : gurbaniLine}
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

export const SimpleTextForPath = React.memo(SimpleTextForPathComponent, pathTextPropsAreEqual);
