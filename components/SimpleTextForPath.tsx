import React, { useState } from 'react';
import { Text, Pressable, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocal } from '@hooks';
import { NavContent } from '@components';
import { SaveIcon } from '@icons';
import { SimpleTextForPathStyles } from '@styles';
import { showErrorAlert } from '@utils/Error';
import { ErrorConstants, UIConstants } from '@constants';

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
  stopAutoScroll: () => void;
}

export const SimpleTextForPath = ({
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
  stopAutoScroll,
}: Props) => {
  const [fontSize, setFontSize] = useState<number>(18);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const { fetchFontSize } = useLocal();

  useFocusEffect(() => {
    const fetch = async () => {
      try {
        const fontSizeData = await fetchFontSize();
        setFontSize(fontSizeData.number);
      } catch (e) {
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_FONT_SIZE);
        setFontSize(18);
      }
    };
    fetch();
  });

  const handleLongPress = () => {
    if (isLongPressing) {
      return;
    }

    Animated.timing(new Animated.Value(0), {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      onSelection();
      setIsLongPressing(true);
      setIsSaving(true);
      setIsSaved(true);
      setPressIndex(index);
      setSavedPathVerseId(verseId);
      stopAutoScroll();
      onSave();
      setIsLongPressing(false);
    });
  };

  const isSelected = verseId === savedPathVerseId || (isSaving && pressIndex === index);
  const accessibilityLabel = `Gurbani line ${index + 1}${isSelected ? ', selected' : ''}`;

  return (
    <Pressable
      onPress={onSelection}
      style={isSelected && SimpleTextForPathStyles.coloredContainer}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Tap to select, long press to save this line"
    >
      <Text
        style={{
          ...SimpleTextForPathStyles.text,
          fontSize,
          lineHeight: fontSize * 2.2,
        }}
        onLongPress={() => {
          handleLongPress();
        }}
        onPress={() => {
          stopAutoScroll();
          if (isSaving) {
            onSelection();
            onSave();
          }
        }}
      >
        {gurbaniLine}
        {(verseId === savedPathVerseId || (isSaving && pressIndex === index)) && (
          <NavContent
            navIcon={
              <SaveIcon
                color={UIConstants.SAVE_ICON_COLOR}
                width={fontSize * 1.2}
                height={fontSize * 1.2}
              />
            }
          />
        )}
      </Text>
    </Pressable>
  );
};
