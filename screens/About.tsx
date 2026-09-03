import React, { useCallback } from 'react';
import { Image, Linking, ScrollView, TouchableOpacity, View, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavContent } from '@components';
import { LeftArrowIcon } from '@icons';
import {
  AboutText,
  BANIDB_URL,
  EDGES_ALL_SIDES,
  KHALIS_FOUNDATION_URL,
  KHALIS_PRIVACY_POLICY_URL,
} from '@constants';
import { AboutScreenStyles as styles, SafeAreaStyle } from '@styles';
import { UIConstants } from '@constants/UIConstants';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { recordError, trackEvent } from '@utils';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

export const About = ({ navigation }: Props) => {
  useScreenAnalytics('About', 'About');

  /**
   * External links open in the system browser, not the in-app auth session —
   * these are ordinary web pages, and the auth session exists to share the SSO
   * cookie jar, which has nothing to do with reading a privacy policy.
   *
   * `openURL` rejects when no handler exists, which on a device with no browser
   * would otherwise surface as an unhandled rejection.
   */
  const openLink = useCallback((url: string, label: string) => {
    trackEvent('About', 'click', label);
    Linking.openURL(url).catch((error) => {
      recordError(error, 'about: could not open external link', { url });
    });
  }, []);

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <View style={styles.container}>
        <View style={styles.navContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={AboutText.BACK}
            accessibilityHint="Tap to go back"
          >
            <NavContent
              navIcon={<LeftArrowIcon color={UIConstants.NAV_TEXT_COLOR} />}
              onPress={() => navigation.goBack()}
            />
            <Text style={styles.navText}>{AboutText.NAV_TITLE}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.appName}>{AboutText.APP_NAME}</Text>
          <Image
            source={require('../assets/Images/Khalis-Foundation-Logo.png')}
            style={styles.khalisLogo}
            accessibilityRole="image"
            accessibilityLabel="Khalis Foundation"
          />

          <Text style={styles.body}>{AboutText.WELCOME}</Text>

          <Text style={styles.body}>
            {AboutText.CONTACT}{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => openLink(KHALIS_FOUNDATION_URL, 'khalisfoundation.org')}
            >
              {KHALIS_FOUNDATION_URL}
            </Text>
          </Text>

          <Text style={styles.body}>{AboutText.RESPECT}</Text>

          <Text style={styles.body}>
            {AboutText.BANIDB_BEFORE}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => openLink(BANIDB_URL, 'banidb')}
            >
              {AboutText.BANIDB_LINK}
            </Text>
            {AboutText.BANIDB_AFTER}
          </Text>

          <Image
            source={require('../assets/Images/BaniDB.png')}
            style={styles.baniDbLogo}
            accessibilityRole="image"
            accessibilityLabel="BaniDB"
          />

          <Text style={styles.blessing}>{AboutText.BHUL_CHUK_MAAF}</Text>

          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => openLink(KHALIS_PRIVACY_POLICY_URL, 'privacy policy')}
          >
            {AboutText.PRIVACY_POLICY}
          </Text>

          <View style={styles.divider} />
          <View style={styles.footer}>
            <Text style={styles.footerText}>{AboutText.COPYRIGHT}</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
