import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import Progressscreen from "./App/screen/Progress-screen";
export default function App() {
  return (
   <Progressscreen/>
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
