import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavContent, SimpleText, FontSize, Larivaar, Angs, Analytics } from '@components';
import { LeftArrowIcon } from '@icons';
import { SettingScreenStyle, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { Constants, EDGES_ALL_SIDES } from '@constants';
import { SafeAreaView } from 'react-native-safe-area-context';

type SettingProps = NativeStackScreenProps<RootStackParamList, 'Setting'>;

export const Settings = ({ navigation }: SettingProps) => {
  useScreenAnalytics('Settings', 'Settings');
  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <View style={SettingScreenStyle.container}>
        <View style={SettingScreenStyle.navContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={SettingScreenStyle.backButton}
            accessibilityLabel="Back"
            accessibilityRole="button"
            accessibilityHint="Tap to go back"
          >
            <NavContent
              navIcon={<LeftArrowIcon color="#fff" />}
              onPress={() => navigation.goBack()}
            />
            <NavContent text={Constants.SETTINGS} contentStyle={SettingScreenStyle.navText} />
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
          <View>
            <SimpleText simpleText={'Other Settings'} />
          </View>
          <Analytics />
        </View>
      </View>
    </SafeAreaView>
  );
};
