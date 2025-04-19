import { Text, Pressable, TouchableOpacity } from "react-native";
import React, { useEffect, useState } from "react";
import { SimpleTextForGurbaniStyles } from "../styles/SimpleTextForPathStyles";
import { SaveIcon } from "../icons/Save.icon";
import { useLocal } from "../hooks/useLocal";
import { useFocusEffect } from "@react-navigation/native";

const { fetchFontSize } = useLocal();

interface Props {
  gurbaniLine: string;
  onPress: () => void;
  isSaving: boolean;
  pressIndex: number;
  index: number;
  iconPress: () => void;
  verseId?: number;
  matchedVerseId?: number;
}

export default function SimpleTextForPath({
  gurbaniLine,
  onPress,
  isSaving,
  pressIndex,
  index,
  iconPress,
  verseId,
  matchedVerseId,
}: Props) {
  const [fontSize, setFontSize] = useState<number>(18);
  useFocusEffect(() => {
    const fetch = async () => {
      const fontSizeData = await fetchFontSize();
      setFontSize(fontSizeData.number);
    };
    fetch();
  });
  return (
    <>
      <Pressable
        onPress={onPress}
        style={
          (verseId == matchedVerseId || (isSaving && pressIndex == index)) &&
          SimpleTextForGurbaniStyles.coloredContainer
        }
      >
        <Text
          style={{
            ...SimpleTextForGurbaniStyles.text,
            fontSize,
            lineHeight: fontSize * 2,
          }}
        >
          {gurbaniLine}
        </Text>
        {isSaving && pressIndex == index ? (
          <TouchableOpacity
            onPress={iconPress}
            style={SimpleTextForGurbaniStyles.icon}
          >
            <SaveIcon color="rgba(17, 51, 106, 1)" />
          </TouchableOpacity>
        ) : null}
      </Pressable>
    </>
  );
}
