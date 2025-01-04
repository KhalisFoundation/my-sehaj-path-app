import React from "react";
import { StyleSheet, View, ImageBackground, Text } from "react-native";

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../assets/SplashBackground.png")}
        style={styles.backgroundImage}
      >
        <View style={styles.blueRectangle}>
          <Text style={[styles.welcomeTitle]}>ਸਹਿਜ ਪਾਠ</Text>
          <Text style={[styles.welcomeSubTitle]}>Building the habit</Text>
          <Text style={styles.welcomeSubTitle}>of reading Gurbani.</Text>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  blueRectangle: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    backgroundColor: "#0D2346",
    opacity: 0.93,
  },
  welcomeTitle: {
    fontSize: 50,
    color: "white",
    textAlign: "center",
    fontFamily: "BalooPaaji2Bold",
  },
  welcomeSubTitle: {
    fontSize: 24,
    lineHeight: 36,
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "BalooPaaji2Regular",
  },
});
