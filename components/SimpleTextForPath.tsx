import { Text, Pressable } from 'react-native';
import React, { useState } from 'react';
import { SimpleTextForPathStyles } from '@styles';
import { useLocal } from '../hooks/useLocal';
import { useFocusEffect } from '@react-navigation/native';
import { NavContent } from './NavContent';
import { SaveIcon } from '@icons/Save.icon';

interface Props {
  gurbaniLine: string;
  onSelection: () => void;
  isSaving: boolean;
  pressIndex: number;
  index: number;
  onSave: () => void;
  verseId?: number;
  savedPathVerseId?: number;
  setIsSaving: any;
  setIsSaved: any;
  setPressIndex: any;
  setSavedPathVerseId: any;
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
}: Props) => {
  const [fontSize, setFontSize] = useState<number>(18);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const { fetchFontSize } = useLocal();
  useFocusEffect(() => {
    const fetch = async () => {
      const fontSizeData = await fetchFontSize();
      setFontSize(fontSizeData.number);
    };
    fetch();
  });
  const handleLongPress = () => {
    if (isLongPressing) {
      return;
    }
    onSelection();
    setIsLongPressing(true);
    setIsSaving(true);
    setIsSaved(false);
    setPressIndex(index);
    setSavedPathVerseId(verseId);
    onSave();
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
          if (isSaving) {
            onSelection();
            onSave();
          }
        }}
      >
        {gurbaniLine}
        {(verseId === savedPathVerseId || (isSaving && pressIndex === index)) && (
          <NavContent navIcon={<SaveIcon color="#0D2346" />} />
        )}
      </Text>
    </Pressable>
  );
};
