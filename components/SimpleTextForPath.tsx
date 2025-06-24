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
  isFirstOfShabad: boolean;
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
  isFirstOfShabad,
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

  return (
    <Pressable
      onPress={onSelection}
      style={
        (verseId === savedPathVerseId || (isSaving && pressIndex === index)) &&
        SimpleTextForPathStyles.coloredContainer
      }
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
