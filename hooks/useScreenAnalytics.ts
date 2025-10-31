import { useEffect } from 'react';
import { trackScreenView } from '@utils';

export const useScreenAnalytics = (screenName: string, screenClass = screenName) => {
  useEffect(() => {
    trackScreenView(screenName, screenClass);
  }, [screenClass, screenName]);
};
