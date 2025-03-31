import { View, Text } from "react-native";
import React from "react";
import { NavContentStyles } from "../styles/NavContentStyles";

interface Props {
  text?: string;
  navIcon?: React.ReactNode;
}
export default function NavContent({ text, navIcon }: Props) {
  return (
    <>
      <View style={NavContentStyles.conatiner}>
        {text ? <Text style={NavContentStyles.navText}>{text}</Text> : navIcon}
      </View>
    </>
  );
}
