import { View, Text, ImageBackground } from "react-native";
import React from "react";
import { SplashScreenStyles } from "../styles/SplashScreenStyles";
import { Constants } from "../constants";

export default function SplashScreen() {
  return (
    <>
      <ImageBackground
        source={require("../assets/Images/SplashScreenBg.png")}
        style={SplashScreenStyles.backgroundImage}
      >
        <View style={SplashScreenStyles.overlayBg}>
          <Text style={SplashScreenStyles.mainHeadline}>
            {Constants.SEHAJ_PATH}
          </Text>
          <Text style={SplashScreenStyles.tagline}>
            {Constants.BUILDING_THE_HABIT}
          </Text>
          <Text style={SplashScreenStyles.tagline}>
            {Constants.OF_READING_GURBANI}
          </Text>
        </View>
      </ImageBackground>
    </>
  );
}
