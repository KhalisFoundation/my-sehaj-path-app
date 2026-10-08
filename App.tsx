import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaStyle } from '@styles';
import {
  SplashScreen,
  HomeScreen,
  Continue,
  PathScreen,
  Settings,
  DatabaseUpdate,
  About,
  Error,
} from '@screens';
import {
  BootSplash,
  HydrationRetry,
  SyncPopup,
  SyncStatusNotice,
  OfflineDbNotice,
  SessionExpiredPopup,
} from '@components';
import { ErrorConstants, Routes } from '@constants';
import { initAuth, retrySessionProfile, useSSOLogin } from '@auth';
import { readSyncPrefs } from './store/syncPrefs';
import { hydrateSignInPopup } from './store/slices/syncSlice';
import { allowTracking, allowCrashReporting, recordError, showErrorAlert } from '@utils';
import { configureApiClient, setTokenGetter } from '@api/config';
import { store } from './store';
import { useAppSelector } from './store/hooks';
import { outbox, persistence } from './store/instance';
import { canSyncNow, onCheckpoint, onForeground, onReconnect } from './store/syncLifecycle';
import { hydrateStore } from './store/persistence';
import { setOnline } from './store/slices/networkSlice';
import { provisionDatabase } from './db';

export type RootStackParamList = {
  Splash: undefined;
  Home: { pathDeleted?: boolean } | undefined;
  Continue: { pathId: number; initialTab?: string };
  Path: { pathId: number };
  Setting: undefined;
  DatabaseUpdate: undefined;
  About: undefined;
  Error: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Enables analytics/crashlytics collection when the user has consented.
 *
 * Must render inside <Provider> and only once the store is hydrated, otherwise
 * it would read the default consent instead of the user's saved choice.
 */
const AnalyticsConsent = () => {
  const consent = useAppSelector((state) => state.settings.analyticsConsent);
  useEffect(() => {
    if (consent) {
      allowTracking();
      allowCrashReporting();
    }
  }, [consent]);
  return null;
};

const App = () => {
  // null = hydrating, false = failed (fail-closed), true = ready
  const [ready, setReady] = useState<boolean | null>(null);

  // Handle the SSO login return deep link (khalissehajpath://login?token=…).
  // Registered once; independent of the store-hydration gate above.
  useSSOLogin();

  const hydrate = useCallback(async () => {
    setReady(null);
    const ok = await hydrateStore(store, {
      onSettingsRecovered: () => showErrorAlert(ErrorConstants.FAILED_TO_LOAD_SETTINGS_RECOVERED),
    });
    if (ok) {
      // Baseline starts at the hydrated state, so boot never rewrites the keys.
      persistence.start();
      // Start the outbox coordinator; it stays dormant until the store is
      // hydrated, signed in, and associated to the account (Step 9).
      outbox.start();

      // This must happen after sync hydration. hydrateEmptySync/hydrateSync
      // replace the sync slice, so reading this earlier could be overwritten
      // and leave the sign-in popup permanently unchecked.
      const prefs = await readSyncPrefs();
      store.dispatch(hydrateSignInPopup(prefs.signInPopupDismissed));

      // Provision the offline reading DB in the BACKGROUND (never awaited): the
      // API fallback covers reading until it lands. The UI shows one simple
      // confirmation popup after a new download completes.
      provisionDatabase();
    }
    setReady(ok);
  }, []);

  useEffect(() => {
    hydrate();

    // Point the generated API client at the configured base URL and have it
    // attach the current SSO token (held in the auth slice) on every request.
    configureApiClient();
    setTokenGetter(() => Promise.resolve(store.getState().auth.token));

    // Resolve auth: consume a cold-start login callback, else hydrate the
    // stored token (serialized so they can't race).
    initAuth().catch((error) => recordError(error, 'auth: initAuth failed'));

    // One NetInfo subscription for the whole app. On a false→true transition,
    // flush anything queued while offline (Step 10 reconnect trigger).
    let wasOnline = store.getState().network.isOnline;

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable);
      store.dispatch(setOnline(online));
      if (online) {
        retrySessionProfile();
      }
      if (online && !wasOnline) {
        onReconnect();
        // Same reasoning as the foreground retry: a download aborted by a
        // dropped connection should resume being attempted once there is one.
        provisionDatabase();
      }
      wasOnline = online;
    });

    // Foreground → push pending work or pull remote changes (Step 10). Leaving
    // the foreground → best-effort durability flush plus a checkpoint push. The
    // on-disk journal covers a batch that had already started before suspension.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        retrySessionProfile();
        onForeground();
        // Returning to the app is the moment to pick the offline DB back up.
        // A download does not survive the app losing focus — the SSO browser
        // alone is enough to kill it — and provisioning otherwise ran only once
        // at boot, so a single interruption left the app on the API until it was
        // fully relaunched. This no-ops when the DB is present or a download is
        // already running.
        provisionDatabase();
      } else if (state === 'inactive' || state === 'background') {
        persistence.flush();
        onCheckpoint();
      }
    });

    // Start catch-up immediately whenever this device becomes syncable. This
    // covers cold start AND signing back into the same account after reading
    // while signed out. Without this edge trigger, a known account's queued
    // work waits for the normal five-second outbox debounce because Home was
    // already focused and therefore does not receive another focus event.
    let wasSyncable = canSyncNow();
    const unsubscribeSyncable = store.subscribe(() => {
      const isSyncable = canSyncNow();
      const justBecameSyncable = isSyncable && !wasSyncable;
      wasSyncable = isSyncable;
      if (justBecameSyncable) {
        onForeground();
      }
    });

    return () => {
      unsubscribeNetInfo();
      appStateSub.remove();
      unsubscribeSyncable();
      // Without this a root remount would re-hydrate while the previous writer
      // is still subscribed to the same store.
      persistence.stop();
      outbox.stop();
    };
  }, [hydrate]);

  return (
    <Provider store={store}>
      {ready === null && <BootSplash />}
      {ready === false && <HydrationRetry onRetry={hydrate} />}
      {ready === true && (
        <SafeAreaProvider style={SafeAreaStyle.safeAreaView}>
          <AnalyticsConsent />
          <SyncStatusNotice />
          <OfflineDbNotice />
          <SessionExpiredPopup />
          {/* A known-account switch is a data boundary, not only a Home-screen
              prompt. Keep it app-wide so B can never continue editing A's
              active paths from the reader while the switch is unresolved. */}
          <SyncPopup mode="accountSwitch" />
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName={Routes.Splash}
              screenOptions={{
                animation: 'default',
                headerShown: false,
                animationDuration: 250,
                gestureDirection: 'horizontal',
              }}
            >
              <Stack.Screen name={Routes.Splash} component={SplashScreen} />
              <Stack.Screen name={Routes.Home} component={HomeScreen} />
              <Stack.Screen name={Routes.Continue} component={Continue} />
              <Stack.Screen name={Routes.Path} component={PathScreen} />
              <Stack.Screen name={Routes.Setting} component={Settings} />
              <Stack.Screen name={Routes.DatabaseUpdate} component={DatabaseUpdate} />
              <Stack.Screen name={Routes.About} component={About} />
              <Stack.Screen name={Routes.Error} component={Error} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      )}
    </Provider>
  );
};

export default App;
