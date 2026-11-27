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
import { useReaderFontSize } from '../hooks/useReaderFontSize';
import { usePathSelection } from './PathSelectionContext';
import { VishraamsText } from './VishraamsText';
import { AndroidParagraphSaveIcon } from './AndroidParagraphSaveIcon';

type ParagraphTextForPathProps = PathTextProps & {
  onTextLayout?: (event: any) => void;
};

const ParagraphTextForPathComponent = ({
  gurbaniLine,
  renderWordSegments,
  onSelection,
  index,
  onSave,
  selectionEnabled = true,
  verseId,
  vishraams,
  vishraamEnabled,
  vishraamsSource: vishraamsSourceOverride,
  onLayout,
  onTextLayout,
}: ParagraphTextForPathProps) => {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  // Selection state from context; display settings from the store.
  const selection = usePathSelection();
  const fontSize = useReaderFontSize();
  const ownVishraam = useAppSelector((state) => state.settings.vishraam);
  const isVishraam = vishraamEnabled ?? ownVishraam;
  const ownVishraamsSource = useAppSelector((state) => state.settings.vishraamsSource.source);
  const vishraamsSource = vishraamsSourceOverride ?? ownVishraamsSource;

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
    if (!selectionEnabled) {
      return;
    }
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
    if (!selectionEnabled) {
      return;
    }
    clearLongPressTimer();
    // Text does not expose delayLongPress. Its native default is 500 ms; use a
    // controlled shorter delay and cancel on movement so paragraph selection is
    // as responsive as line mode without firing while the reader scrolls.
    longPressTimer.current = setTimeout(
      () => {
        longPressTimer.current = null;
        triggerLongPress();
      },
      Platform.OS === 'ios' ? 350 : 500
    );
  };

  const handlePressOut = () => {
    clearLongPressTimer();
  };

  const handlePress = () => {
    if (!selectionEnabled) {
      return;
    }
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

  // The trailing space is load-bearing: it separates verses in the paragraph
  // flow AND the layout matcher measures each verse as `${renderedText} `.
  const verseContent = (
    <>
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
    </>
  );

  return (
    <Text
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={selectionEnabled ? 'button' : 'text'}
      onPressIn={selectionEnabled ? handlePressIn : undefined}
      onPressOut={handlePressOut}
      accessibilityHint={
        selectionEnabled ? 'Tap to select, long press to save this line' : undefined
      }
      disabled={!selectionEnabled || selection.isSaved || selection.found}
      suppressHighlighting={true}
      style={textStyle}
      allowFontScaling={false}
      onLayout={onLayout}
      onTextLayout={onTextLayout}
    >
      {/*
        Only wrap when there is actually a highlight to apply. `selectedTextStyle`
        is undefined unless this verse is selected, so the wrapper used to add a
        node AND a nesting level to every verse for no visual effect. In
        paragraph mode a whole shabad is one text tree, so that doubled the nodes
        Android had to lay out.
      */}
      {isSelected ? (
        <Text style={selectedTextStyle} allowFontScaling={false}>
          {verseContent}
        </Text>
      ) : (
        verseContent
      )}

      {isSelected && (
        <Text allowFontScaling={false}>
          {Platform.OS === 'android' ? (
            <AndroidParagraphSaveIcon size={fontSize * 1.2} />
          ) : (
            <SaveIcon
              color={UIConstants.SAVE_ICON_COLOR}
              width={fontSize * 1.2}
              height={fontSize * 1.2}
              style={{ transform: [{ translateY: -fontSize * 0.3 }] }}
            />
          )}
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
