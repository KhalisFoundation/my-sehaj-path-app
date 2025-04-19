import React from "react";
import { SafeAreaView } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SplashScreen from "./screens/SplashScreen";
import HomeScreen from "./screens/HomeScreen";
import Continue from "./screens/Continue";
import { PathScreen } from "./screens/PathScreen";
import { Settings } from "./screens/Setting";

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Continue: { pathId: number };
  Path: { pathId: number | undefined };
  Setting: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Continue" component={Continue} />
          <Stack.Screen name="Path" component={PathScreen} />
          <Stack.Screen name="Setting" component={Settings} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

export default App;
