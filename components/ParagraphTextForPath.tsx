import React, { useRef, useEffect } from 'react';
import { Platform, Text } from 'react-native';
import { UIConstants } from '@constants';
import { SaveIcon } from '@icons';
import {
  PathTextProps,
  useIsSelected,
  useAccessibilityLabel,
  useTextStyle,
  createLongPressHandler,
  pathTextPropsAreEqual,
} from '@utils';
import { useAppSelector } from '../store/hooks';
import { usePathSelection } from './PathSelectionContext';
import { VishraamsText } from './VishraamsText';

type ParagraphTextForPathProps = PathTextProps & {
  onTextLayout?: (event: any) => void;
};

const ParagraphTextForPathComponent = ({
  gurbaniLine,
  renderWordSegments,
  onSelection,
  index,
  onSave,
  verseId,
  vishraams,
  onLayout,
  onTextLayout,
}: ParagraphTextForPathProps) => {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

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
  const selectedTextStyle = isSelected
    ? { backgroundColor: UIConstants.PATH_SELECTED_BACKGROUND_COLOR }
    : undefined;

  const baseLongPressHandler = createLongPressHandler(
    index,
    verseId,
    selection,
    onSave,
    onSelection
  );

  const triggerLongPress = () => {
    didLongPress.current = true;
    baseLongPressHandler();
  };

  const clearLongPressTimer = () => {
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePressIn = () => {
    clearLongPressTimer();
    // Text does not expose delayLongPress. Its native default is 500 ms; use a
    // controlled shorter delay and cancel on movement so paragraph selection is
    // as responsive as line mode without firing while the reader scrolls.
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      triggerLongPress();
    }, 180);
  };

  const handlePressOut = () => {
    clearLongPressTimer();
  };

  const handlePress = () => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    if (selection.isSaving) {
      onSelection();
      onSave();
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current !== null) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
  }, []);

  return (
    <>
      <Text
        onPress={handlePress}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityHint="Tap to select, long press to save this line"
        disabled={selection.isSaved || selection.found}
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
          <SaveIcon
            color={UIConstants.SAVE_ICON_COLOR}
            width={fontSize * 1.2}
            height={fontSize * 1.2}
            style={{ transform: [{ translateY: Platform.OS === 'ios' ? '-25%' : '25%' }] }}
          />
        )}
      </Text>
    </>
  );
};

export const ParagraphTextForPath = React.memo(
  ParagraphTextForPathComponent,
  (prevProps, nextProps) =>
    pathTextPropsAreEqual(prevProps, nextProps) && prevProps.onTextLayout === nextProps.onTextLayout
);
