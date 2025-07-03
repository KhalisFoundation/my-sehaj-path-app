import React, { useState } from 'react';
import { Text, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocal } from '@hooks/useLocal';
import { NavContent } from '@components';
import { SaveIcon } from '@icons';
import { SimpleTextForPathStyles } from '@styles';

interface Props {
  gurbaniLine: string;
  onSelection: () => void;
  isSaving: boolean;
  pressIndex: number;
  index: number;
  onSave: () => void;
  verseId?: number;
  savedPathVerseId?: number;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setPressIndex: React.Dispatch<React.SetStateAction<number>>;
  setSavedPathVerseId: React.Dispatch<React.SetStateAction<number | undefined>>;
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
