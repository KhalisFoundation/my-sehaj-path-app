import { StyleSheet } from "react-native";
import font from "../utils/font";

export const SplashScreenStyles = StyleSheet.create({
  container: {
    width: "100%",
  },
  backgroundImage: {
    width: "100%",
    height: "100%",
  },
  blueRectangle: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    backgroundColor: "rgba(13, 35, 70, 1)",
    opacity: 0.9,
  },
  splashTitle: {
    fontSize: 48,
    color: "white",
    textAlign: "center",
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    lineHeight: 85,
  },
  splashSubTitle: {
    fontSize: 24,
    color: "white",
    textAlign: "center",
    fontFamily: font.Baloo_Paaji_2_Regular,
    lineHeight: 36,
  },
});
