import { ImageBackground, StyleSheet, Text, View } from "react-native";
import font from "../utils/font";

const SplashScreen = () => {
  return (
    <>
      <View style={styles.container}>
        <ImageBackground
          source={require("../images/SplashBackground.png")}
          style={styles.backgroundImage}
        >
          <View style={styles.blueRectangle}>
            <Text style={styles.splashTitle}>ਸਹਿਜ ਪਾਠ</Text>
            <Text style={styles.splashSubTitle}>Building the habit</Text>
            <Text style={styles.splashSubTitle}>of reading Gurbani</Text>
          </View>
        </ImageBackground>
      </View>
    </>
  );
};

export default SplashScreen;
const styles = StyleSheet.create({
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
