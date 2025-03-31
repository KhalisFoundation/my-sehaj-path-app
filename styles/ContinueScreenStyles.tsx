import { StyleSheet } from "react-native";
import font from "../utils/font";
export const ContinueScreenStyles = StyleSheet.create({
  backgroundImage: {
    height: "100%",
  },
  scrollContainer: {
    minHeight: "100%",
  },
  container: {
    backgroundColor: "rgba(245, 245, 245,0.89)",
    height: "100%",
    borderWidth: 4,
    borderRightWidth: 6,
    borderColor: "rgba(253, 198, 6, 0.3)",
    padding: 35,
    paddingTop: 26,
    gap: 10,
  },
  navContainer: {
    flexDirection: "row",
    gap: 15,
    alignItems: "center",
  },
  sehajHeadingContainer: {
    flexDirection: "row",
    marginTop: 30,
  },
  sehajHeading: {
    fontSize: 48,
    fontFamily: font.Brandon_Grotesque_Medium,
  },
  waheguruHeading: {
    fontFamily: font.Baloo_Paaji_2_Extra_Bold,
    fontSize: 16,
    marginTop: 24,
  },
  impTextContainer: {
    padding: 1,
    backgroundColor: "rgba(253, 198, 6, 0.3)",
    borderRadius: 10,
    transform: [{ translateY: 10 }],
  },
  textStyle: {
    fontSize: 24,
  },
  streakScroll: {
    flexDirection: "row",
    gap: 6,
    width: 246,
  },
  streakScrollContainer: {
    maxHeight: 85,
    marginTop: 10,
    marginBottom: 48,
  },
});
