import { StyleProp, Text, TextStyle } from "react-native";
import React from "react";
import { ImportantTextStyles } from "../styles/ImportantTextStyles";

interface Props {
  importantText: string;
  importantTextStyles?: StyleProp<TextStyle>;
}

export default function ImportantText({
  importantText,
  importantTextStyles,
}: Props) {
  return (
    <>
      <Text style={[ImportantTextStyles.importantText, importantTextStyles]}>
        {importantText}
      </Text>
    </>
  );
}
