import React from 'react';
import { ImageBackground, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Constants } from '@constants';
import { SplashScreenStyles } from '@styles';

/**
 * Purely visual splash shown while the store hydrates from AsyncStorage.
 *
 * This must stay presentational: it renders OUTSIDE NavigationContainer, so it
 * cannot use navigation (the `SplashScreen` route calls `navigation.replace`
 * and would crash here) or any screen-level hooks.
 */
export const BootSplash = () => (
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
);
