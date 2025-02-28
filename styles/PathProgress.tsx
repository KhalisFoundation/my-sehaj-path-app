import { StyleSheet } from "react-native";
import font from "../utils/font";

interface width {
  screenWidth: number;
}
export const CreatePathProgressCardStyles = ({ screenWidth }: width) => {
  return StyleSheet.create({
    container: {
      width: screenWidth < 768 ? 199 : 239,
      height: screenWidth < 768 ? 220 : 264,
      backgroundColor: "white",
      borderRadius: 15,
      padding: screenWidth < 768 ? 20 : 24,
      justifyContent: "space-between",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      marginRight: 16,
    },
    textContainer: {
      alignItems: "center",
      marginBottom: screenWidth < 768 ? 2 : 4,
    },
    sehajText: {
      fontFamily: font.Brandon_Grotesque_Black,
      fontSize: screenWidth < 768 ? 18 : 22,
      lineHeight: screenWidth < 768 ? 26 : 31,
      textAlign: "center",
      color: "#11336A",
    },
    angText: {
      fontFamily: font.Brandon_Grotesque_Regular,
      fontSize: screenWidth < 768 ? 14 : 17,
      lineHeight: screenWidth < 768 ? 20 : 24,
      textAlign: "center",
      color: "#666666",
    },
    angNumber: {
      fontFamily: "BrandonGrotesque-Bold",
      color: "#11336A",
    },
    progressContainer: {
      width: screenWidth < 768 ? 53 : 72,
      height: screenWidth < 768 ? 53 : 72,
      justifyContent: "center",
      alignItems: "center",
      marginTop: "auto",
      marginBottom: "auto",
    },
  });
};
