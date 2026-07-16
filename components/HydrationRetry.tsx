import React from 'react';
import { ImageBackground, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EDGES_ALL_SIDES } from '@constants';
import { SafeAreaStyle, SplashScreenStyles } from '@styles';
import { PrimaryButton } from './PrimaryButton';

interface HydrationRetryProps {
  onRetry: () => void;
}

/**
 * Fail-closed screen shown when saved data could not be read safely.
 *
 * We deliberately do NOT render the app in this state: an empty store plus any
 * user action would overwrite the real data on disk. Nothing has been modified
 * on disk at this point, so a retry (or a later app launch) can still recover.
 *
 * Presentational only — it renders outside NavigationContainer. There is no
 * destructive "reset data" action here by design.
 */
export const HydrationRetry = ({ onRetry }: HydrationRetryProps) => (
  <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
    <ImageBackground
      source={require('../assets/Images/SplashScreenBg.png')}
      style={SplashScreenStyles.backgroundImage}
    >
      <View style={SplashScreenStyles.overlayBg}>
        <Text style={SplashScreenStyles.mainHeadline}>
          We couldn&apos;t safely load your saved paths
        </Text>
        <Text style={SplashScreenStyles.tagline}>Your saved data has not been changed.</Text>
        <Text style={SplashScreenStyles.tagline}>Please try again.</Text>
        <PrimaryButton buttonTitle="Retry" onPress={onRetry} />
      </View>
    </ImageBackground>
  </SafeAreaView>
);
