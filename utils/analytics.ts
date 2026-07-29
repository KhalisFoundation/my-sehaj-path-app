import {
  getAnalytics,
  getAppInstanceId,
  logEvent,
  setAnalyticsCollectionEnabled,
  logScreenView,
} from '@react-native-firebase/analytics';
import { getApp } from '@react-native-firebase/app';
import { store } from '../store';

let analytics: ReturnType<typeof getAnalytics> | null = null;
try {
  const app = getApp();
  analytics = getAnalytics(app);
} catch (error) {
  // Analytics initialization failed - app will continue without analytics
}
const sanitize = (value?: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'unknown';

const isAnalyticsReady = (): boolean => !!analytics;

/**
 * Consent now lives in the store, so this is a synchronous read instead of an
 * AsyncStorage round-trip on every tracked event.
 */
const checkConsent = (): boolean => store.getState().settings.analyticsConsent;

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

  const hasConsent = checkConsent();
  if (!hasConsent) {
    return;
  }
  const categorySanitized = sanitize(category);
  const actionSanitized = sanitize(action);
  const labelSanitized = sanitize(label);

  try {
    await logEvent(analytics!, categorySanitized, { [actionSanitized]: labelSanitized });
  } catch (error) {
    // Failed to log event - continue without analytics
  }
};

const trackEvent = (category: string, action: string, label: string) => {
  safeLogEvent(category, action, label);
};

const trackScreenView = async (screenName: string, screenClass = screenName) => {
  if (!isAnalyticsReady()) {
    return;
  }

  const hasConsent = checkConsent();
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

export { allowTracking, trackEvent, trackScreenView };
