import { View } from "react-native";
import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import NavContent from "../components/NavContent";
import GoBackIcon from "../icons/GoBack.icon";
import { SettingScreenStyle } from "../styles/SettingStyle";
import SimpleText from "../components/SimpleText";
import FontSize from "../components/Settings/FontSize";
import Larivaar from "../components/Settings/Larivaar";

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
