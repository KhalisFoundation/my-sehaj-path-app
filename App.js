import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';


export default function App() {
  let [fontsLoaded] = useFonts({
    'BrandonGrotesque-Regular': require('./App/assets/fonts/brandon-grotesque-regular.otf'),
    'BrandonGrotesque-Bold': require('./App/assets/fonts/brandon-grotesque-bold.otf'),
    'BrandonGrotesque-Light': require('./App/assets/fonts/brandon-grotesque-light.otf'),
    'BrandonGrotesque-Medium': require('./App/assets/fonts/brandon-grotesque-medium.otf'),
    'BrandonGrotesque-Black': require('./App/assets/fonts/brandon-grotesque-black.otf'),
  });

  if (!fontsLoaded) {
    return null; 
  }

  return (
      <View >
      </View>
  );
}
