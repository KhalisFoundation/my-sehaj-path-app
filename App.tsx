import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaStyle } from '@styles';
import { SplashScreen, HomeScreen, Continue, PathScreen, Settings, Error } from '@screens';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Continue: { pathId: number };
  Path: { pathId: number };
  Setting: undefined;
  Error: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <SafeAreaProvider style={SafeAreaStyle.safeAreaView}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Continue" component={Continue} />
          <Stack.Screen name="Path" component={PathScreen} />
          <Stack.Screen name="Setting" component={Settings} />
          <Stack.Screen name="Error" component={Error} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
