import { Text, Pressable, TouchableOpacity } from "react-native";
import React from "react";
import { SimpleTextForGurbaniStyles } from "../styles/SimpleTextForGurbaniStyles";
import { SaveIcon } from "../icons/Save.icon";

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
  return (
    <>
      <Pressable
        onPress={onPress}
        style={
          (verseId == matchedVerseId || (isSaving && pressIndex == index)) &&
          SimpleTextForGurbaniStyles.coloredContainer
        }
      >
        <Text style={SimpleTextForGurbaniStyles.text}>{gurbaniLine}</Text>
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
