import { View, Text, ImageBackground, Animated } from "react-native";
import React, { useEffect, useRef } from "react";
import { SplashScreenStyles } from "../styles/SplashScreenStyles";
import { Constants } from "../constants";
import { RootStackParamList } from "../App";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type SplashProps = NativeStackScreenProps<RootStackParamList, "Splash">;

export default function SplashScreen({ navigation }: SplashProps) {
  const fadeOut = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(fadeOut, {
      toValue: 0,
      duration: 1500,
      useNativeDriver: true,
    }).start(() => {
      navigation.push("Home");
    });
  }, []);
  return (
    <>
      <Animated.View style={{ opacity: fadeOut }}>
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
      </Animated.View>
    </>
  );
}
