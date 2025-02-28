import { StyleSheet } from "react-native";
import font from "../utils/font";

export const HomeScreenStyles = StyleSheet.create({
  backgroundImage: {
    resizeMode: "cover",
    transform: [{ scale: 1.2 }, { translateX: 0 }],
    width: "300%",
    height: "100%",
    overflow: "hidden",
  },
  container: {
    backgroundColor: "rgba(245, 245, 245,0.89)",
    height: "100%",
    padding: 15,
    paddingTop: 59,
  },
  headingContainer: { marginBottom: 20 },
  header: {
    fontSize: 27,
    color: "#11336A",
    textAlign: "center",
    fontFamily: font.Recoleta_Regular,
    lineHeight: 38,
  },
  startButtonContainer: {
    alignItems: "center",
    marginBottom: 41,
  },
  startButton: {
    padding: 7,
    backgroundColor: "transparent",
    justifyContent: "center",
    borderRadius: 100,
  },
  startButtonText: {
    color: "white",
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: font.Baloo_Paaji_2_Regular,
  },
  pathStartButtonIcon: {
    width: 24,
    height: 24,
    marginRight: 11,
  },
  sectionTitleContainer: {
    alignItems: "center",
    marginBottom: 15,
    marginTop: 20,
  },
  sectionTitle: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#11336A",
  },
  horizontalScroll: {
    flexDirection: "row",
    marginBottom: 40,
  },
  completedText: {
    fontSize: 16,
    color: "#11336A",
  },
  completedAngText: {
    fontSize: 14,
    color: "#666666",
  },
});
