import React, { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
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
import { deleteAccount } from '@auth';
import { showDeleteAccountConfirmAlert, showErrorAlert } from '@utils';
import { useAppSelector } from '../store/hooks';
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

  const isSignedIn = useAppSelector((state) => state.auth.status === 'signedIn');

  // iOS only, by product decision.
  //
  // Apple guideline 5.1.1(v) makes in-app account deletion mandatory for App
  // Store review, so the row exists to satisfy that.
  //
  // Only the row is gated: `deleteAccount` itself is platform-agnostic and makes
  // the same call wherever it runs.
  const canDeleteAccount = isSignedIn && Platform.OS === 'ios';

  // Disabled while in flight: a second tap fires a second DELETE, and the server
  // answers that one 409 — harmless, but it reads as a failure to a user whose
  // account is being deleted perfectly well.
  const [deleting, setDeleting] = useState(false);

  const runDeleteAccount = useCallback(async () => {
    setDeleting(true);
    const result = await deleteAccount();
    setDeleting(false);

    // Success, already-scheduled and unauthorized have all signed this device
    // out already, so the app falls back to the signed-out UI by itself and
    // there is no navigation to do. What each still needs is to be TOLD — an app
    // that silently empties itself is alarming.
    // A rolled-back wipe leaves the previous account's paths on disk, so the
    // user must be told to reinstall rather than reassured. Both branches below
    // deleted the account server-side, so neither is an ordinary failure.
    if (result.ok) {
      if (result.cleared) {
        Alert.alert(Constants.ACCOUNT_DELETED_TITLE, Constants.ACCOUNT_DELETED_MESSAGE);
      } else {
        showErrorAlert(ErrorConstants.ACCOUNT_DELETED_NOT_CLEARED);
      }
      return;
    }

    if (result.reason === 'already_scheduled') {
      if (result.cleared === false) {
        showErrorAlert(ErrorConstants.ACCOUNT_DELETED_NOT_CLEARED);
        return;
      }
      Alert.alert(
        Constants.ACCOUNT_ALREADY_SCHEDULED_TITLE,
        Constants.ACCOUNT_ALREADY_SCHEDULED_MESSAGE
      );
      return;
    }

    if (result.reason === 'last_admin') {
      // NOT a deletion. The account still exists and this device still holds its
      // reading, so this must never read like the others.
      showErrorAlert(ErrorConstants.ACCOUNT_DELETION_LAST_ADMIN);
      return;
    }

    if (result.reason === 'network' || result.reason === 'server') {
      // Showing the status beats hiding it while this flow is new: "(HTTP 404)"
      // tells whoever is testing that the endpoint is not deployed, where a bare
      // apology tells them nothing.
      const detail = result.reason === 'network' ? 'No response' : `HTTP ${result.status}`;
      showErrorAlert(`${ErrorConstants.FAILED_TO_DELETE_ACCOUNT} (${detail})`);
    }
    // `unauthorized` and `no_session` need no alert: the device is already
    // signed out, and the sign-in prompt is what greets them.
  }, []);

  const confirmDeleteAccount = () =>
    showDeleteAccountConfirmAlert({
      onConfirm: () => {
        runDeleteAccount();
      },
    });

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
        {/*
          Scrollable, not a plain View. The list already overflows a small screen
          at the larger font settings, and the two most consequential rows —
          About and Delete Account — sit at the very bottom, so an unscrollable
          list makes account deletion unreachable. That is the one thing App
          Store review checks for.
        */}
        <ScrollView
          contentContainerStyle={SettingScreenStyle.settingContainer}
          showsVerticalScrollIndicator={false}
        >
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

          <TouchableOpacity
            style={SettingScreenStyle.databaseUpdateRow}
            onPress={() => navigation.push(Routes.About)}
            accessibilityRole="button"
            accessibilityLabel="About"
            accessibilityHint="Who made this app, and the privacy policy"
          >
            <View style={SettingScreenStyle.databaseUpdateCopy}>
              <Text style={SettingScreenStyle.databaseUpdateText}>{Constants.ABOUT}</Text>
            </View>
            <RightChevronIcon />
          </TouchableOpacity>

          {/*
            Required by App Store guideline 5.1.1(v), which insists the option
            lives in the app and is not buried behind support. Only shown while
            signed in — there is no account to delete otherwise, and a dead row
            would be the kind of thing a reviewer taps first.
          */}
          {canDeleteAccount && (
            <TouchableOpacity
              style={SettingScreenStyle.deleteAccountRow}
              onPress={confirmDeleteAccount}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              accessibilityHint="Permanently deletes your Khalis account after 30 days"
            >
              <View style={SettingScreenStyle.databaseUpdateCopy}>
                <Text style={SettingScreenStyle.deleteAccountText}>{Constants.DELETE_ACCOUNT}</Text>
              </View>
              <RightChevronIcon />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
