import React, { useEffect, useRef } from 'react';
import { View, Text, ImageBackground, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Constants } from '@constants';
import { SplashScreenStyles, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';

type SplashProps = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen = ({ navigation }: SplashProps) => {
  const fadeOut = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace('Home');
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fadeOut, navigation]);
  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <Animated.View style={{ opacity: fadeOut }}>
        <ImageBackground
          source={require('../assets/Images/SplashScreenBg.png')}
          style={SplashScreenStyles.backgroundImage}
        >
          <View style={SplashScreenStyles.overlayBg}>
            <Text style={SplashScreenStyles.mainHeadline}>{Constants.SEHAJ_PATH}</Text>
            <Text style={SplashScreenStyles.tagline}>{Constants.BUILDING_THE_HABIT}</Text>
            <Text style={SplashScreenStyles.tagline}>{Constants.OF_READING_GURBANI}</Text>
          </View>
        </ImageBackground>
      </Animated.View>
    </SafeAreaView>
  );
};
