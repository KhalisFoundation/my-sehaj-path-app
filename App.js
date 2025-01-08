import * as Font from "expo-font";
import { useEffect, useState } from "react";

import HomeScreen from "./App/Screens/HomeScreen";
import SplashScreen from "./App/Screens/SplashScreen";
export default function App() {
  const [fontsLoaded] = Font.useFonts({
    BalooPaaji2Bold: require("./App/assets/Fonts/BalooPaaji2Bold.ttf"),
    BalooPaaji2Regular: require("./App/assets/Fonts/BalooPaaji2Regular.ttf"),
    "BrandonGrotesque-Black": require("./App/assets/Fonts/BrandonGrotesque-Black.otf"),
    "BrandonGrotesque-BlackItalic": require("./App/assets/Fonts/BrandonGrotesque-BlackItalic.otf"),
    "BrandonGrotesque-Bold": require("./App/assets/Fonts/BrandonGrotesque-Bold.otf"),
    "BrandonGrotesque-BoldItalic": require("./App/assets/Fonts/BrandonGrotesque-BoldItalic.otf"),
    "BrandonGrotesque-Light": require("./App/assets/Fonts/BrandonGrotesque-Light.otf"),
    "BrandonGrotesque-LightItalic": require("./App/assets/Fonts/BrandonGrotesque-LightItalic.otf"),
    "BrandonGrotesque-Medium": require("./App/assets/Fonts/BrandonGrotesque-Medium.otf"),
    "BrandonGrotesque-MediumItalic": require("./App/assets/Fonts/BrandonGrotesque-MediumItalic.otf"),
    "BrandonGrotesque-Regular": require("./App/assets/Fonts/BrandonGrotesque-Regular.otf"),
    "BrandonGrotesque-RegularItalic": require("./App/assets/Fonts/BrandonGrotesque-RegularItalic.otf"),
    "Recoleta-Regular": require("./App/assets/Fonts/Recoleta-Regular.otf"),
  });
  const [showSplash, setshowSplash] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setshowSplash(false);
    }, 3000);
  }, []);

  return (
    <>
      {fontsLoaded ? (
        <>
          {showSplash && <SplashScreen />}
          {!showSplash && <HomeScreen />}
        </>
      ) : undefined}
    </>
  );
}
