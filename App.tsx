import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
function App() {
  return (
    <>
      <SafeAreaView>
        <View style={styleSheet.background}>
          <Text style={styleSheet.text}>Khalis Foundation</Text>

          <Text style={styleSheet.text}>Sheaj-Path-App</Text>
        </View>
      </SafeAreaView>
    </>
  );
}
const styleSheet = StyleSheet.create({
  background: {
    backgroundColor: "black",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "white",
    fontSize: 25,
  },
});
export default App;
