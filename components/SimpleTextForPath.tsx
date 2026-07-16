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
} from '@utils';
import { useAppSelector } from '../store/hooks';
import { usePathSelection } from './PathSelectionContext';
import { VishraamsText } from './VishraamsText';

const SimpleTextForPathComponent = ({
  gurbaniLine,
  renderWordSegments,
  onSelection,
  index,
  onSave,
  verseId,
  vishraams,
  onLayout,
}: PathTextProps) => {
  const isLongPressingRef = useRef<boolean>(false);

  // Selection state from context; display settings from the store.
  const selection = usePathSelection();
  const fontSize = useAppSelector((state) => state.settings.fontSize.number);
  const isVishraam = useAppSelector((state) => state.settings.vishraam);
  const vishraamsSource = useAppSelector((state) => state.settings.vishraamsSource.source);

  const isSelected = useIsSelected(
    verseId,
    selection.savedPathVerseId,
    selection.isSaving,
    selection.pressIndex,
    index
  );
  const accessibilityLabel = useAccessibilityLabel(index, isSelected);
  const textStyle = useTextStyle(fontSize);
  const containerStyle = useContainerStyle(isSelected);

  const baseLongPressHandler = createLongPressHandler(
    index,
    verseId,
    selection,
    onSave,
    onSelection
  );

  const handleLongPress = () => {
    if (isLongPressingRef.current) {
      return;
    }
    isLongPressingRef.current = true;
    baseLongPressHandler();
    isLongPressingRef.current = false;
  };

  const handlePress = createPressHandler(selection.isSaving, onSelection, onSave);

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
      disabled={selection.isSaved || selection.found}
      onLayout={onLayout}
    >
      <Text suppressHighlighting={true} style={textStyle}>
        {isVishraam ? (
          <VishraamsText
            gurbaniLine={gurbaniLine}
            renderWordSegments={renderWordSegments}
            vishraams={vishraams}
            vishraamsSource={vishraamsSource}
          />
        ) : (
          gurbaniLine
        )}
      </Text>
      {isSelected && (
        <SaveIcon
          color={UIConstants.SAVE_ICON_COLOR}
          width={fontSize * 1.2}
          height={fontSize * 1.2}
        />
      )}
    </Pressable>
  );
};

export const SimpleTextForPath = React.memo(SimpleTextForPathComponent, pathTextPropsAreEqual);
