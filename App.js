import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import ProgressCard from './App/components/ProgressCard';


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
      <View style={styles.borderContainer}>
        <View style={styles.container}>
          <ProgressCard sehajNumber={14} angNumber={745} progress={50} />
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  borderContainer: {
    flex: 1,
    borderWidth: 4,
    borderColor: '#FDC6064D',
    borderRadius: 10, 
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});