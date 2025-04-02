import { StyleSheet } from "react-native";
import font from "../utils/font";

export const SplashScreenStyles = StyleSheet.create({
  backgroundImage: {
    height: "100%",
    width: "100%",
  },
  overlayBg: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(13, 35, 70, 0.9)",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mainHeadline: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 48,
    color: "rgba(255, 255, 255, 1)",
  },
  tagline: {
    fontFamily: font.Baloo_Paaji_2_Regular,
    fontSize: 24,
    color: "rgba(255, 255, 255, 1)",
  },
});
