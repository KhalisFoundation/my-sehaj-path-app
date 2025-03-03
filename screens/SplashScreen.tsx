import { ImageBackground, Text, View } from "react-native";
import { SplashScreenStyles } from "../styles/SplashScreen";
import { Constants } from "../constants/Constants";

const SplashScreen = () => {
  return (
    <>
      <View style={SplashScreenStyles.container}>
        <ImageBackground
          source={require("../images/SplashBackground.png")}
          style={SplashScreenStyles.backgroundImage}
        >
          <View style={SplashScreenStyles.blueRectangle}>
            <Text style={SplashScreenStyles.splashTitle}>
              {Constants.SEHAJ_PATH}
            </Text>
            <Text style={SplashScreenStyles.splashSubTitle}>
              {Constants.SPLASH_SCREEN_SUB_TITLE_1}
            </Text>
            <Text style={SplashScreenStyles.splashSubTitle}>
              {Constants.SPLASH_SCREEN_SUB_TITLE_2}
            </Text>
          </View>
        </ImageBackground>
      </View>
    </>
  );
};

export default SplashScreen;
