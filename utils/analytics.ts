import {
  getAnalytics,
  getAppInstanceId,
  logEvent,
  setAnalyticsCollectionEnabled,
  logScreenView,
} from '@react-native-firebase/analytics';
import { getApp } from '@react-native-firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';

let analytics: ReturnType<typeof getAnalytics> | null = null;
try {
  const app = getApp();
  analytics = getAnalytics(app);
} catch (error) {
  // Analytics initialization failed - app will continue without analytics
}
const sanitize = (value?: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'undefined';

const isAnalyticsReady = (): boolean => !!analytics;

const checkConsent = async (): Promise<boolean> => {
  try {
    const consent = await AsyncStorage.getItem('consent');
    return consent === null ? true : consent === 'true';
  } catch (error) {
    return true;
  }
};

const allowTracking = async () => {
  if (!isAnalyticsReady()) {
    return;
  }
  try {
    const appInstanceId = await getAppInstanceId(analytics!);
    if (!appInstanceId) {
      await setAnalyticsCollectionEnabled(analytics!, true);
    }
  } catch (error) {
    // Analytics tracking setup failed - continue without analytics
  }
};
const safeLogEvent = async (category: string, action: string, label: string) => {
  if (!isAnalyticsReady()) {
    return;
  }

  const hasConsent = await checkConsent();
  if (!hasConsent) {
    return;
  }
  const c = sanitize(category);
  const a = sanitize(action);
  const l = sanitize(label);

  try {
    await logEvent(analytics!, c, { [a]: l });
  } catch (error) {
    // Failed to log event - continue without analytics
  }
};

const trackPathCreatedEvent = (action: string, label: string) => {
  safeLogEvent('pathCreated', action, label);
};
const pathCompletedEvent = (action: string, label: string) => {
  safeLogEvent('pathCompleted', action, label);
};
const trackSettingEvent = (action: string, label: string) => {
  safeLogEvent('setting', action, label);
};
const trackScreenView = async (screenName: string, screenClass = screenName) => {
  if (!isAnalyticsReady()) {
    return;
  }

  const hasConsent = await checkConsent();
  if (!hasConsent) {
    return;
  }

  try {
    await logScreenView(analytics!, {
      screen_name: sanitize(screenName),
      screen_class: sanitize(screenClass.replace(/\s+/g, '')),
    });
  } catch (error) {
    // Failed to log screen view - continue without analytics
  }
};

const trackNextAngsByTopNavEvent = (action: string, label: string) => {
  safeLogEvent('nextAngsByTopNav', action, label);
};
const trackPreviousAngsByTopNavEvent = (action: string, label: string) => {
  safeLogEvent('previousAngsByTopNav', action, label);
};
const trackAngsByAngsNavigationEvent = (action: string, label: string) => {
  safeLogEvent('angsByAngsNavigation', action, label);
};
const trackAngsByBottomNavEvent = (action: string, label: string) => {
  safeLogEvent('angsByBottomNav', action, label);
};
const trackTabSwitchEvent = (action: string, label: string) => {
  safeLogEvent('tabSwitch', action, label);
};
const trackPathRenameEvent = (action: string, label: string) => {
  safeLogEvent('pathRename', action, label);
};

export {
  allowTracking,
  trackSettingEvent,
  trackScreenView,
  trackTabSwitchEvent,
  trackPathCreatedEvent,
  pathCompletedEvent,
  trackNextAngsByTopNavEvent,
  trackPreviousAngsByTopNavEvent,
  trackAngsByBottomNavEvent,
  trackPathRenameEvent,
  trackAngsByAngsNavigationEvent,
};
