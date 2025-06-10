import { Text, Pressable, Animated } from 'react-native';
import React, { useRef, useState } from 'react';
import { SimpleTextForPathStyles } from '@styles';
import { useLocal } from '../hooks/useLocal';
import { useFocusEffect } from '@react-navigation/native';

interface Props {
  gurbaniLine: string;
  onSelection: () => void;
  isSaving: boolean;
  pressIndex: number;
  index: number;
  onSave: () => void;
  verseId?: number;
  matchedVerseId?: number;
  setIsSaving: any;
  setIsSaved: any;
  setPressIndex: any;
}

export const SimpleTextForPath = ({
  gurbaniLine,
  onSelection,
  isSaving,
  pressIndex,
  index,
  onSave,
  verseId,
  matchedVerseId,
  setIsSaved,
  setIsSaving,
  setPressIndex,
}: Props) => {
  const [fontSize, setFontSize] = useState<number>(18);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { fetchFontSize } = useLocal();
  useFocusEffect(() => {
    const fetch = async () => {
      const fontSizeData = await fetchFontSize();
      setFontSize(fontSizeData.number);
    };
    fetch();
  });
  const handleLongPress = () => {
    setIsSaving(true);
    setIsSaved(false);
    setPressIndex(index);
    onSelection();
    onSave();
    setTimeout(() => {
      fadeAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start(() => {
        setIsSaving(false);
        setIsSaved(false);
      });
    }, 1000);
  };

  return (
    <Pressable
      onPress={onSelection}
      style={
        (verseId === matchedVerseId || (isSaving && pressIndex === index)) &&
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
      </Text>
    </Pressable>
  );
};
