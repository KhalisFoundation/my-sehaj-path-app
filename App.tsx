// import { StatusBar } from "expo-status-bar";
// import { StyleSheet, Text, View } from "react-native";
// import Welcomescreen from "./App/screens/Welcomescreen"
// import Progressscreen from "./App/screens/Progress-screen"


// export default function App() {
//   return (
//     <View style={styles.container}>
//     {/* <Welcomescreen/> */}
//     <Progressscreen/>
    
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#fff",
//     alignItems: "center",
//     justifyContent: "center",
//   },
// });
import {NavigationContainer} from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack";
import Welcomescreen from "./App/screens/Welcomescreen"
import Progressscreen from "./App/screens/Progress-screen"
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
// export type RootStackParamList = {
//   Welcomescreen: undefined;
//   Progressscreen: { productId: string }; 
// };
// const Stack=createStackNavigator<RootStackParamList>()
export default function App() {
    return (
//   <NavigationContainer>
//     <Stack.Navigator initialRouteName="Welcomescreen">
// <Stack.Screen
// name="Welcomescreen"
// component={Welcomescreen}
// options={{title:"trending products"}}
// />
// <Stack.Screen
// name="Progressscreen"
// component={Progressscreen}
// options={{title:"product details"}}
// />
//     </Stack.Navigator>
//   </NavigationContainer>
<Progressscreen/>
    );
  }
  