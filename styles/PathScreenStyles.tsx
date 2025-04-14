import { StyleSheet } from "react-native";
import font from "../utils/font";

export const PathScreenStyles = StyleSheet.create({
  container: {
    borderWidth: 4,
    borderRightWidth: 5,
    borderColor: "rgba(253, 198, 6, 0.3)",
    height: "100%",
    width: "100%",
  },
  navContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    position: "absolute",
    right: 10,
    zIndex: 8,
  },
  pathContentContainer: {
    padding: 15,
    paddingTop: 20,
  },
  pathContent: {
    color: "#000",
    fontSize: 18,
    lineHeight: 36,
    fontFamily: font.Baloo_Paaji_2_Medium,
  },
});
