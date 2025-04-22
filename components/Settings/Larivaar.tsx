import { View } from "react-native";
import React from "react";
import { SimpleText } from "../index";
import { LarivaarStyles } from "@styles";
import { Switch } from "@rneui/themed";
import { useState, useEffect } from "react";
import { useLocal } from "../../hooks/useLocal";

export const Larivaar = () => {
  const [isLarivaar, setIsLarivaar] = useState<boolean>(false);
  const { saveLarivaar, fetchLarivaar } = useLocal();
  const handleLarivaar = (larivaar: boolean) => {
    setIsLarivaar(larivaar);
    saveLarivaar(larivaar);
  };
  useEffect(() => {
    const fetchFromLocal = async () => {
      const larivaar = await fetchLarivaar();
      setIsLarivaar(larivaar || false);
    };
    fetchFromLocal();
  }, []);
  return (
    <View style={LarivaarStyles.container}>
      <SimpleText
        simpleText={"Larivaar"}
        simpleTextStyle={LarivaarStyles.fontSizeText}
      />
      <Switch
        value={isLarivaar}
        onValueChange={handleLarivaar}
        trackColor={{
          false: "rgb(194, 194, 194)",
          true: "rgba(17, 51, 106, 0.46)",
        }}
        thumbColor={isLarivaar ? "rgb(17, 51, 106)" : "rgb(142, 142, 142)"}
      />
    </View>
  );
};
