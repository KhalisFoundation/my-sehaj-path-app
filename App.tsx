import React, { useEffect } from "react";
import { SafeAreaView } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SplashScreen from "./screens/SplashScreen";
import HomeScreen from "./screens/HomeScreen";
import Continue from "./screens/Continue";
import { BaniDB } from "./utils/BaniDB";
import { PathScreen } from "./screens/PathScreen";

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  Continue: { pathId: number };
  Path: { pathId: number | undefined };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App() {
  useEffect(() => {
    BaniDB(0);
  }, []);
  return (
    <>
      <SafeAreaView style={{ flex: 1 }}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Splash">
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Continue"
              component={Continue}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Path"
              component={PathScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </>
  );
}

export default App;
