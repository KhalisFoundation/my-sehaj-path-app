import React from 'react';
import { SafeAreaView, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavContent, SimpleText, FontSize, Larivaar, Angs } from '@components';
import { GoBackIcon } from '@icons';
import { SettingScreenStyle, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { Constants } from '@constants';
import { useScreenAnalytics } from '@hooks';

type SettingProps = NativeStackScreenProps<RootStackParamList, 'Setting'>;

export const Settings = ({ navigation }: SettingProps) => {
  useScreenAnalytics('Settings', 'Settings');
  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <View style={SettingScreenStyle.container}>
        <View style={SettingScreenStyle.navContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={SettingScreenStyle.backButton}
            accessibilityLabel="Back"
            accessibilityRole="button"
            accessibilityHint="Tap to go back"
          >
            <NavContent navIcon={<GoBackIcon />} />
            <NavContent text={Constants.SETTINGS} />
          </TouchableOpacity>
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
