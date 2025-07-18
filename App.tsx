import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaStyle } from '@styles';
import { SplashScreen, HomeScreen, Continue, PathScreen, Settings, Error } from '@screens';
import { Routes } from '@constants';

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
        <Stack.Navigator initialRouteName={Routes.Splash} screenOptions={{ headerShown: false }}>
          <Stack.Screen name={Routes.Splash} component={SplashScreen} />
          <Stack.Screen name={Routes.Home} component={HomeScreen} />
          <Stack.Screen name={Routes.Continue} component={Continue} />
          <Stack.Screen name={Routes.Path} component={PathScreen} />
          <Stack.Screen name={Routes.Setting} component={Settings} />
          <Stack.Screen name={Routes.Error} component={Error} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
