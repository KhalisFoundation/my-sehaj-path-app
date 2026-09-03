/**
 * App version shown on the About screen.
 *
 * Hand-maintained, because this app has no `react-native-device-info` and React
 * Native exposes no bundle version of its own. Keep in step with:
 *   iOS      ios/KhalisSehajPathApp.xcodeproj  MARKETING_VERSION / CURRENT_PROJECT_VERSION
 *   Android  android/app/build.gradle          versionName / versionCode
 *
 * Those two are currently out of step with each other (iOS 2.0.0 build 16,
 * Android 2.0.1 build 12), so this shows the marketing version only — a build
 * number that contradicts the store listing is worse than no build number.
 */

export const AboutText = {
  NAV_TITLE: 'About',
  BACK: 'Back',
  APP_NAME: 'Khalis Sehaj Path',
  CREATED_BY: 'Created By:',
  WELCOME: 'We welcome your comments, suggestions, and corrections!',
  CONTACT: 'For information, suggestions, or help, visit us at',
  RESPECT: 'Please respectfully cover your head and remove your shoes when using this app.',
  BANIDB_BEFORE: 'Khalis Sehaj Path utilises ',
  BANIDB_LINK: 'BaniDB',
  BANIDB_AFTER:
    ' — the open source gurbani database and api used in many gurbani applications, such as SikhiToTheMax.',
  BHUL_CHUK_MAAF: 'Bhul Chuk Maaf!',
  PRIVACY_POLICY: 'Privacy Policy',
  COPYRIGHT: '© 2026 Khalis Foundation',
} as const;

export const KHALIS_FOUNDATION_URL = 'https://khalisfoundation.org';
export const KHALIS_PRIVACY_POLICY_URL = 'https://khalisfoundation.org/about/privacy-policy/';
export const BANIDB_URL = 'https://banidb.com';
