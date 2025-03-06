import React from "react";
import { SafeAreaView, Text, View } from "react-native";
import PrimaryButton from "./components/PrimaryButton";
import Start from "./icons/Start";
function App() {
  return (
    <>
      <SafeAreaView>
        <View>
          <PrimaryButton
            buttonTitle={"START"}
            Icon={<Start />}
            onPress={() => {
              console.log("hello");
            }}
            containerStyle={{ borderRadius: 100 }}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

export default App;
