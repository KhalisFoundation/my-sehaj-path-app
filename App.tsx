import React from "react";
import { SafeAreaView } from "react-native";
import HomeScreen from "./screens/HomeScreen";
import Continue from "./screens/Continue";

function App() {
  return (
    <>
      <SafeAreaView style={{ flex: 1 }}>
        <Continue pathId={1} />
        {/* <HomeScreen /> */}
      </SafeAreaView>
    </>
  );
}

export default App;
