import { ImageBackground, Text, View } from "react-native";
import { SplashScreenStyles } from "../styles/SplashScreen";

const SplashScreen = () => {
  return (
    <>
      <View style={SplashScreenStyles.container}>
        <ImageBackground
          source={require("../images/SplashBackground.png")}
          style={SplashScreenStyles.backgroundImage}
        >
          <View style={SplashScreenStyles.blueRectangle}>
            <Text style={SplashScreenStyles.splashTitle}>ਸਹਿਜ ਪਾਠ</Text>
            <Text style={SplashScreenStyles.splashSubTitle}>
              Building the habit
            </Text>
            <Text style={SplashScreenStyles.splashSubTitle}>
              of reading Gurbani
            </Text>
          </View>
        </ImageBackground>
      </View>
    </>
  );
};

export default SplashScreen;
