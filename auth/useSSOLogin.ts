import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { consumeLoginUrl } from './loginCallback';

/**
 * Handles the SSO login return deep link while the app is already running
 * (warm). The cold-start case is handled once by `initAuth` (bootstrap) so the
 * initial URL and stored-token hydration don't race — this hook does NOT read
 * getInitialURL. Dedupes repeat deliveries of the same URL.
 */
export function useSSOLogin(): void {
  const processedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      if (processedUrlRef.current === url) {
        return;
      }
      processedUrlRef.current = url;
      const consumed = await consumeLoginUrl(url);
      if (!consumed) {
        // Allow a later, legitimate callback with the same URL to retry.
        processedUrlRef.current = null;
      }
    };

    const listener = Linking.addEventListener('url', handleDeepLink);
    return () => listener.remove();
  }, []);
}
