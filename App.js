import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import Welcomescreen from "./App/screens/Welcomescreen"
import Progressscreen from "./App/screens/Progress-screen"


export default function App() {
  return (
    <View style={styles.container}>
    {/* <Welcomescreen/> */}
    <Progressscreen/>
    
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
