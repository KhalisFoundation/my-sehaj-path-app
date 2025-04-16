import { Text, Pressable, TouchableOpacity } from "react-native";
import React from "react";
import { SimpleTextForGurbaniStyles } from "../styles/SimpleTextForGurbaniStyles";
import { SaveIcon } from "../icons/Save.icon";

interface Props {
  gurbaniLine: string;
  onPress: () => void;
  isSaving: boolean;
  verseId: number;
  index: number;
  iconPress: () => void;
}

export default function SimpleTextForPath({
  gurbaniLine,
  onPress,
  isSaving,
  verseId,
  index,
  iconPress,
}: Props) {
  return (
    <>
      <Pressable
        onPress={onPress}
        style={
          isSaving && verseId == index
            ? SimpleTextForGurbaniStyles.coloredContainer
            : SimpleTextForGurbaniStyles.container
        }
      >
        <Text style={SimpleTextForGurbaniStyles.text}>{gurbaniLine}</Text>
        {isSaving && verseId == index ? (
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
