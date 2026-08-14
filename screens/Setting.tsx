import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavContent, SimpleText, SwitchSettingItem, DropdownSettingItem } from '@components';
import { LeftArrowIcon, RightChevronIcon } from '@icons';
import {
  SettingScreenStyle,
  SafeAreaStyle,
  LarivaarStyles,
  ParagraphModeStyles,
  FontSizeStyle,
  AngsFormatStyles,
} from '@styles';
import { RootStackParamList } from '../App';
import { useScreenAnalytics, useSetting } from '@hooks';
import {
  Constants,
  EDGES_ALL_SIDES,
  ErrorConstants,
  FontSizes,
  AngsFormatArray,
  Routes,
  VishraamsSourceArray,
  VishraamsSourceLabels,
} from '@constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AngsFormat, FontSizeData, VishraamsSource } from '../types';
import {
  setAngsFormat,
  setAnalyticsConsent,
  setFontSize,
  setLarivaar,
  setParagraphMode,
  setVishraam,
  setVishraamsSource,
} from '../store/slices/settingsSlice';

type SettingProps = NativeStackScreenProps<RootStackParamList, 'Setting'>;

export const Settings = ({ navigation }: SettingProps) => {
  useScreenAnalytics('Settings', 'Settings');

  const [fontSize, changeFontSize] = useSetting(
    (state) => state.settings.fontSize,
    setFontSize,
    ErrorConstants.FAILED_TO_SAVE_FONT_SIZE
  );
  const [angsFormat, changeAngsFormat] = useSetting(
    (state) => state.settings.angsFormat,
    setAngsFormat,
    ErrorConstants.FAILED_TO_SAVE_ANG_FORMAT
  );
  const [paragraphMode, changeParagraphMode] = useSetting(
    (state) => state.settings.paragraphMode,
    setParagraphMode,
    ErrorConstants.FAILED_TO_SAVE_PARAGRAPH_MODE
  );
  const [vishraam, changeVishraam] = useSetting(
    (state) => state.settings.vishraam,
    setVishraam,
    ErrorConstants.FAILED_TO_SAVE_VISHRAAM
  );
  const [vishraamsSource, changeVishraamsSource] = useSetting(
    (state) => state.settings.vishraamsSource,
    setVishraamsSource,
    ErrorConstants.FAILED_TO_SAVE_VISHRAAM_SOURCE
  );
  const [larivaar, changeLarivaar] = useSetting(
    (state) => state.settings.larivaar,
    setLarivaar,
    ErrorConstants.FAILED_TO_SAVE_LARIVAAR
  );
  const [analyticsConsent, changeAnalyticsConsent] = useSetting(
    (state) => state.settings.analyticsConsent,
    setAnalyticsConsent,
    ErrorConstants.FAILED_TO_SAVE_ANALYTICS
  );

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

            <DropdownSettingItem<FontSizeData>
              settingKey="fontSize"
              label={Constants.FONT_SIZE}
              overlayTitle={Constants.SELECT_YOUR_FONT_SIZE}
              options={FontSizes.map((size) => ({ value: size, label: size.fontSize }))}
              value={fontSize}
              onValueChange={changeFontSize}
              containerStyle={FontSizeStyle.container}
              textStyle={FontSizeStyle.fontSizeText}
              overlayHeaderStyle={FontSizeStyle.overlayHeader}
              overlayTextContainerStyle={FontSizeStyle.overlayTextContainer}
              overlayTextStyle={FontSizeStyle.overlayText}
              overlayContainerStyle={FontSizeStyle.overlayContainer}
              overlayContentStyle={FontSizeStyle.overlayContent}
              getDisplayValue={(value: FontSizeData) => value.fontSize || 'Default'}
              isEqual={(a: FontSizeData, b: FontSizeData) => a.fontSize === b.fontSize}
            />

            <DropdownSettingItem<AngsFormat>
              settingKey="angsFormat"
              label={Constants.ANG_NUMBERING}
              overlayTitle={Constants.SELECT_YOUR_ANG_FORMAT}
              options={AngsFormatArray.map((format) => ({ value: format, label: format.format }))}
              value={angsFormat}
              onValueChange={changeAngsFormat}
              containerStyle={AngsFormatStyles.container}
              textStyle={AngsFormatStyles.angsText}
              overlayHeaderStyle={AngsFormatStyles.overlayHeader}
              overlayTextContainerStyle={AngsFormatStyles.overlayTextContainer}
              overlayTextStyle={AngsFormatStyles.overlayText}
              getDisplayValue={(value: AngsFormat) => value.format}
              isEqual={(a: AngsFormat, b: AngsFormat) => a.format === b.format}
              showCheckmark={false}
            />

            <SwitchSettingItem
              settingKey="paragraphMode"
              label={Constants.PARAGRAPH_MODE}
              value={paragraphMode}
              onValueChange={changeParagraphMode}
              containerStyle={ParagraphModeStyles.container}
              textStyle={ParagraphModeStyles.fontSizeText}
            />

            <SwitchSettingItem
              settingKey="vishraam"
              label={Constants.VISHRAAM}
              value={vishraam}
              onValueChange={changeVishraam}
              containerStyle={ParagraphModeStyles.container}
              textStyle={ParagraphModeStyles.fontSizeText}
            />

            <DropdownSettingItem<VishraamsSource>
              settingKey="vishraamsSource"
              label="Vishraam Source"
              overlayTitle="Select Vishraam Source"
              options={VishraamsSourceArray.map((source) => ({
                value: source,
                label: VishraamsSourceLabels[source.source],
              }))}
              value={vishraamsSource}
              onValueChange={changeVishraamsSource}
              containerStyle={AngsFormatStyles.container}
              textStyle={AngsFormatStyles.angsText}
              overlayHeaderStyle={AngsFormatStyles.overlayHeader}
              overlayTextContainerStyle={AngsFormatStyles.overlayTextContainer}
              overlayTextStyle={AngsFormatStyles.overlayText}
              getDisplayValue={(value: VishraamsSource) => VishraamsSourceLabels[value.source]}
              isEqual={(a: VishraamsSource, b: VishraamsSource) => a.source === b.source}
              showCheckmark={false}
            />
          </View>

          <View>
            <View>
              <SimpleText simpleText={Constants.BANI_OPTIONS} />
            </View>
            <SwitchSettingItem
              settingKey="larivaar"
              label={Constants.LARIVAAR}
              value={larivaar}
              onValueChange={changeLarivaar}
              containerStyle={LarivaarStyles.container}
              textStyle={LarivaarStyles.fontSizeText}
            />
          </View>

          <View>
            <SimpleText simpleText={'Other Settings'} />
          </View>
          <SwitchSettingItem
            settingKey="analytics"
            label={Constants.ANALYTICS}
            value={analyticsConsent}
            onValueChange={changeAnalyticsConsent}
            containerStyle={LarivaarStyles.container}
            textStyle={LarivaarStyles.fontSizeText}
          />
          <TouchableOpacity
            style={SettingScreenStyle.databaseUpdateRow}
            onPress={() => navigation.push(Routes.DatabaseUpdate)}
            accessibilityRole="button"
            accessibilityLabel="Update database"
            accessibilityHint="Checks for a newer offline reading database"
          >
            <View style={SettingScreenStyle.databaseUpdateCopy}>
              <Text style={SettingScreenStyle.databaseUpdateText}>{Constants.DATABASE}</Text>
            </View>
            <RightChevronIcon />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};
