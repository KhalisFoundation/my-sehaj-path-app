import { StyleProp, Text, TextStyle } from "react-native";
import React from "react";
import { SimpleTextStyles } from "../styles/SimpleTextStyles";

interface Props {
  simpleText: string[] | React.ReactNode[] | string;
  simpleTextStyle?: StyleProp<TextStyle>;
}

export default function SimpleText({ simpleText, simpleTextStyle }: Props) {
  return (
    <>
      <Text style={[SimpleTextStyles.simpleText, simpleTextStyle]}>
        {typeof simpleText == "string"
          ? simpleText
          : simpleText.map((text, index) => (
              <React.Fragment key={index}>{text}</React.Fragment>
            ))}
      </Text>
    </>
  );
}
