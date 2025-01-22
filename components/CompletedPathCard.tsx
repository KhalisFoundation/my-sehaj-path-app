import React from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import font from "../utils/font";
interface Props {
  sheajPathNumber: number;
  pathCompletionDate: string;
}
const CompletedPathCard = ({ sheajPathNumber, pathCompletionDate }: Props) => {
  const { width: screenWidth } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      width: screenWidth < 768 ? 130 : 156,
      height: screenWidth < 768 ? 107 : 128,
      backgroundColor: "white",
      borderRadius: 15,
      padding: 15,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#11336A",
      shadowOffset: { width: 15, height: 15 },
      shadowOpacity: 0.1,
      shadowRadius: 45,
      elevation: 5,
      marginRight: 16,
    },
    sehajText: {
      fontFamily: font.Brandon_Grotesque_Regular,
      fontSize: screenWidth < 768 ? 16 : 18,
      lineHeight: screenWidth < 768 ? 24 : 26,
      textAlign: "center",
      color: "#11336A",
    },
    dateText: {
      fontFamily: font.Brandon_Grotesque_Regular,
      fontSize: screenWidth < 768 ? 14 : 16,
      lineHeight: screenWidth < 768 ? 20 : 22,
      textAlign: "center",
      color: "#666666",
      marginTop: 4,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.sehajText}>Sehaj #{sheajPathNumber}</Text>
      <Text style={styles.dateText}>{pathCompletionDate}</Text>
    </View>
  );
};

export default CompletedPathCard;
