import React from "react";
import {
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { PrimaryButtonStyles } from "../styles/PrimaryButton";

interface Props {
  buttonTitle: string;
  Icon: React.ReactNode;
  onPress: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export default function PrimaryButton({
  buttonTitle,
  Icon,
  onPress,
  containerStyle,
  textStyle,
}: Props) {
  return (
    <>
      <LinearGradient
        colors={["#11336A", "#0D2346"]}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 1, y: 0 }}
        style={[PrimaryButtonStyles.container, containerStyle]}
      >
        <TouchableOpacity onPress={onPress} style={PrimaryButtonStyles.button}>
          <View>{Icon}</View>
          <Text style={[PrimaryButtonStyles.text, textStyle]}>
            {buttonTitle}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    </>
  );
}
