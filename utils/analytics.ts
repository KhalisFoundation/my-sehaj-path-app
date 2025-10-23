import {
  getAnalytics,
  getAppInstanceId,
  logEvent,
  setAnalyticsCollectionEnabled,
  logScreenView,
} from '@react-native-firebase/analytics';
import { getApp } from '@react-native-firebase/app';

const app = getApp();
const analytics = getAnalytics(app);

const allowTracking = async () => {
  const appInstanceId = await getAppInstanceId(analytics);
  if (!appInstanceId) {
    await setAnalyticsCollectionEnabled(analytics, true);
  }
};
const trackEvent = (category: string, action: string, label: string) => {
  logEvent(analytics, category, { [action]: label });
};
const trackPathCreatedEvent = (action: string, label: string) => {
  trackEvent('pathCreated', action, label);
};
const pathCompletedEvent = (action: string, label: string) => {
  trackEvent('pathCompleted', action, label);
};
const trackSettingEvent = (action: string, label: string) => {
  trackEvent('setting', action, label);
};
const trackScreenView = (screenName: string, screenClass = screenName) => {
  logScreenView(analytics, {
    screen_name: screenName,
    screen_class: screenClass.replace(/\s+/g, ''),
  });
};
const trackNextAngsByTopNavEvent = (action: string, label: string) => {
  trackEvent('nextAngsByTopNav', action, label);
};
const trackPreviousAngsByTopNavEvent = (action: string, label: string) => {
  trackEvent('previousAngsByTopNav', action, label);
};
const trackAngsByAngsNavigationEvent = (action: string, label: string) => {
  trackEvent('angsByAngsNavigation', action, label);
};
const trackAngsByBottomNavEvent = (action: string, label: string) => {
  trackEvent('angsByBottomNav', action, label);
};
const trackTabSwitchEvent = (action: string, label: string) => {
  trackEvent('tabSwitch', action, label);
};
const trackPathRenameEvent = (action: string, label: string) => {
  trackEvent('pathRename', action, label);
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
