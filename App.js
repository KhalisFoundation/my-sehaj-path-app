import { StyleSheet, Text, View } from "react-native";
import * as Font from "expo-font";

import SplashScreen from "./App/Screens/SplashScreen";
export default function App() {
  const [fontsLoaded] = Font.useFonts({
    BalooPaaji2Bold: require("./App/assets/Fonts/BalooPaaji2Bold.ttf"),
    BalooPaaji2Regular: require("./App/assets/Fonts/BalooPaaji2Regular.ttf"),
  });

  return (
    <>
      {fontsLoaded ? <SplashScreen /> : console.log("no fonts are not loaded")}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "BalooPaaji2-Bold",
  },
});
