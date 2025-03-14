import { StyleSheet } from "react-native";

export const HomeScreenStyles = StyleSheet.create({
  backgroundImage: {
    height: "100%",
    transform: [{ scale: 1.1 }, { translateX: 0 }],
  },
  container: {
    backgroundColor: "rgba(245, 245, 245,0.89)",
    transform: [{ scale: 0.92 }, { translateX: 0 }],
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    paddingTop: 59,
    height: "100%",
  },
  scrollContainer: {
    minHeight: "100%",
  },
  startButtonContainer: {
    borderRadius: 100,
  },
  pathInProgressContianer: {
    marginTop: 41,
  },
  pathCompletedContainer: {
    marginTop: 30,
  },
});
