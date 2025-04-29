import { StyleProp, Text, TextStyle, View } from "react-native";
import React from "react";
import { ImportantTextStyles } from "@styles";

interface Props {
  importantText: string;
  importantTextStyles?: StyleProp<TextStyle>;
}

export const ImportantText = ({
  importantText,
  importantTextStyles,
}: Props) => {
  return (
    <Text style={[ImportantTextStyles.importantText, importantTextStyles]}>
      {importantText}
    </Text>
  );
};
