import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavContent, SimpleText, SwitchSettingItem, DropdownSettingItem } from '@components';
import { LeftArrowIcon } from '@icons';
import { SettingScreenStyle, SafeAreaStyle, LarivaarStyles, ParagraphModeStyles, FontSizeStyle, AngsFormatStyles } from '@styles';
import { RootStackParamList } from '../App';
import { useScreenAnalytics, useLocal, FontSizeData, AngsFormat } from '@hooks';
import { Constants, EDGES_ALL_SIDES, ErrorConstants, FontSizes, AngsFormatArray } from '@constants';
import { SafeAreaView } from 'react-native-safe-area-context';

type SettingProps = NativeStackScreenProps<RootStackParamList, 'Setting'>;

export const Settings = ({ navigation }: SettingProps) => {
  useScreenAnalytics('Settings', 'Settings');
  const { 
    saveFontSize, fetchFontSize,
    saveAngsFormat, fetchAngsFormat,
    saveParagraphMode, fetchParagraphMode,
    saveLarivaar, fetchLarivaar,
    saveConsent, fetchConsent,
    saveVishraam, fetchVishraam
  } = useLocal();

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
              label="Font-Size"
              overlayTitle={Constants.SELECT_YOUR_FONT_SIZE}
              options={FontSizes.map(size => ({ value: size, label: size.fontSize }))}
              saveFn={saveFontSize}
              fetchFn={fetchFontSize}
              errorMessages={{
                loadError: ErrorConstants.FAILED_TO_LOAD_FONT_SIZE,
                saveError: ErrorConstants.FAILED_TO_SAVE_FONT_SIZE,
              }}
              defaultValue={{ fontSize: 'Small (Default)', number: 18 }}
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
              options={AngsFormatArray.map(format => ({ value: format, label: format.format }))}
              saveFn={saveAngsFormat}
              fetchFn={fetchAngsFormat}
              errorMessages={{
                loadError: ErrorConstants.FAILED_TO_LOAD_ANG_FORMAT,
                saveError: ErrorConstants.FAILED_TO_SAVE_ANG_FORMAT,
              }}
              defaultValue={{ format: 'Punjabi' }}
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
              label={Constants.PARAGRAPHMODE}
              saveFn={saveParagraphMode}
              fetchFn={fetchParagraphMode}
              errorMessages={{
                loadError: ErrorConstants.FAILED_TO_LOAD_PARAGRAPH_MODE,
                saveError: ErrorConstants.FAILED_TO_SAVE_PARAGRAPH_MODE,
              }}
              defaultValue={false}
              containerStyle={ParagraphModeStyles.container}
              textStyle={ParagraphModeStyles.fontSizeText}
            />

            <SettingItem
              settingKey="vishraam"
              label={Constants.VISHRAAM}
              saveFn={saveVishraam}
              fetchFn={fetchVishraam}
              errorMessages={{
                loadError: ErrorConstants.FAILED_TO_LOAD_VISHRAAM,
                saveError: ErrorConstants.FAILED_TO_SAVE_VISHRAAM,
              }}
              defaultValue={false}
              containerStyle={ParagraphModeStyles.container}
              textStyle={ParagraphModeStyles.fontSizeText}
            />
          </View>
          
          <View>
            <View>
              <SimpleText simpleText={Constants.BANI_OPTIONS} />
            </View>
            <SwitchSettingItem
              settingKey="larivaar"
              label={Constants.LARIVAAR}
              saveFn={saveLarivaar}
              fetchFn={fetchLarivaar}
              errorMessages={{
                loadError: ErrorConstants.FAILED_TO_LOAD_LARIVAAR,
                saveError: ErrorConstants.FAILED_TO_SAVE_LARIVAAR,
              }}
              defaultValue={false}
              containerStyle={LarivaarStyles.container}
              textStyle={LarivaarStyles.fontSizeText}
            />
          </View>
          
          <View>
            <SimpleText simpleText={'Other Settings'} />
          </View>
          <SwitchSettingItem
            settingKey="analytics"
            label="Collect Analytics"
            saveFn={saveConsent}
            fetchFn={fetchConsent}
            errorMessages={{
              loadError: ErrorConstants.FAILED_TO_LOAD_ANALYTICS,
              saveError: ErrorConstants.FAILED_TO_SAVE_ANALYTICS,
            }}
            defaultValue={true}
            containerStyle={LarivaarStyles.container}
            textStyle={LarivaarStyles.fontSizeText}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};
