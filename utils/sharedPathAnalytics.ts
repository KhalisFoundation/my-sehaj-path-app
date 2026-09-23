import { SharedPathAnalytics, type SharedPathAnalyticsEvent } from '@constants/Analytics';
import { trackEvent } from './analytics';

/** Records a deliberate shared-path button press with no personal data. */
export const trackSharedPathEvent = (event: SharedPathAnalyticsEvent): void => {
  const detail = SharedPathAnalytics[event];
  trackEvent(detail.category, 'click', detail.label);
};
