import { SharedPathAnalytics, type SharedPathAnalyticsEvent } from '@constants/Analytics';
import { trackEvent } from './analytics';

// Error details belong in Crashlytics. Analytics only records successful or
// user-cancelled outcomes, never API failures or exception messages.
export type SharedPathAnalyticsOutcome = 'success' | 'cancelled';

/** Records a deliberate shared-path button press with no personal data. */
export const trackSharedPathEvent = (event: SharedPathAnalyticsEvent): void => {
  const detail = SharedPathAnalytics[event];
  trackEvent(detail.category, 'click', detail.label);
};

/** Records the result of a tracked action without sending path or user data. */
export const trackSharedPathOutcome = (
  event: SharedPathAnalyticsEvent,
  outcome: SharedPathAnalyticsOutcome
): void => {
  const detail = SharedPathAnalytics[event];
  trackEvent(detail.category, 'result', `${detail.label} ${outcome}`);
};
