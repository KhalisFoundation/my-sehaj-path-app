import React from 'react';
import { ImageBackground, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EDGES_ALL_SIDES } from '@constants';
import { SafeAreaStyle, HydrationRetryStyles } from '@styles';
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
 * destructive "reset data" action here by design. The tone is reassuring: the
 * headline of this screen is that the user's data is safe.
 */
export const HydrationRetry = ({ onRetry }: HydrationRetryProps) => (
  <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
    <ImageBackground
      source={require('../assets/Images/SplashScreenBg.png')}
      style={HydrationRetryStyles.background}
    >
      <View style={HydrationRetryStyles.overlay}>
        <Text style={HydrationRetryStyles.title}>We couldn&apos;t load your saved paths</Text>

        <Text style={HydrationRetryStyles.reassurance}>
          Don&apos;t worry — your saved data is safe and has not been changed.
        </Text>
        <Text style={HydrationRetryStyles.hint}>Please try again.</Text>

        <PrimaryButton buttonTitle="Retry" onPress={onRetry} />
      </View>
    </ImageBackground>
  </SafeAreaView>
);
