import { View } from "react-native";
import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { GoBackIcon } from "@icons";
import { SettingScreenStyle } from "@styles";
import { NavContent, SimpleText, FontSize, Larivaar } from "@components";

type SettingProps = NativeStackScreenProps<RootStackParamList, "Setting">;

export const Settings = ({ navigation }: SettingProps) => {
  return (
    <View style={SettingScreenStyle.container}>
      <View style={SettingScreenStyle.navContainer}>
        <NavContent
          navIcon={<GoBackIcon />}
          onPress={() => navigation.goBack()}
        />
        <NavContent text="Settings" />
      </View>
      <View style={SettingScreenStyle.settingContainer}>
        <View>
          <View>
            <SimpleText simpleText={"Display Options"} />
          </View>
          <FontSize />
        </View>
        <View>
          <View>
            <SimpleText simpleText={"Bani Options"} />
          </View>
          <Larivaar />
        </View>
      </View>
    </View>
  );
};
