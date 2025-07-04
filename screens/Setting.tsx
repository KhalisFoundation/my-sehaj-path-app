import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavContent, SimpleText, FontSize, Larivaar, Angs } from '@components';
import { GoBackIcon } from '@icons';
import { SettingScreenStyle, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { Constants } from '@constants';

type SettingProps = NativeStackScreenProps<RootStackParamList, 'Setting'>;

export const Settings = ({ navigation }: SettingProps) => {
  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <View style={SettingScreenStyle.container}>
        <View style={SettingScreenStyle.navContainer}>
          <NavContent navIcon={<GoBackIcon />} onPress={() => navigation.goBack()} />
          <NavContent text="Settings" />
        </View>
        <View style={SettingScreenStyle.settingContainer}>
          <View>
            <View>
              <SimpleText simpleText={Constants.DISPLAY_OPTIONS} />
            </View>
            <FontSize />
            <Angs />
          </View>
          <View>
            <View>
              <SimpleText simpleText={Constants.BANI_OPTIONS} />
            </View>
            <Larivaar />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};
