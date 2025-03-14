import React from "react";
import { SafeAreaView, View } from "react-native";
import HomeScreen from "./screens/HomeScreen";

function App() {
  return (
    <>
      <SafeAreaView style={{ flex: 1 }}>
        <HomeScreen />
      </SafeAreaView>
    </>
  );
}

export default App;
