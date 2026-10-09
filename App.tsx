import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SafeAreaStyle } from '@styles';
import {
  ChooseSlot,
  JoinPath,
  GroupPath,
  InviteMember,
  SplashScreen,
  HomeScreen,
  Continue,
  CreatePath,
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
import { ErrorConstants, Routes, UIConstants } from '@constants';
import { linking } from './navigation/linking';
import { initAuth, retrySessionProfile, useSSOLogin } from '@auth';
import { readSyncPrefs } from './store/syncPrefs';
import { hydrateSignInPopup } from './store/slices/syncSlice';
import { isOnlineFrom } from './store/slices/networkSlice';
import {
  allowTracking,
  allowCrashReporting,
  recordError,
  showErrorAlert,
  registerPushNotifications,
  subscribePushTap,
  flushPendingPushTaps,
  trackEvent,
  isTurnNotificationType,
} from '@utils';
import { configureApiClient, setTokenGetter } from '@api/config';
import { store } from './store';
import { useAppSelector } from './store/hooks';
import { outbox, persistence } from './store/instance';
import { canSyncNow, onCheckpoint, onForeground, onReconnect } from './store/syncLifecycle';
import { hydrateStore } from './store/persistence';
import { setOnline } from './store/slices/networkSlice';
import { provisionDatabase } from './db';
import { notifyPlanRefresh } from './store/planEvents';
import { pushNavigationRef } from './navigation/pushTapRouter';

export type RootStackParamList = {
  Splash: undefined;
  Home: { pathDeleted?: boolean; pathMembershipEnded?: boolean } | undefined;
  Continue: {
    pathId: number;
    /** Keeps a stale Continue route identifiable after its local card is pruned. */
    sehajPathId?: string;
    initialTab?: 'progress' | 'streak' | 'turns' | 'members';
    /** Changes on every notification tap so an already-mounted route reacts. */
    notificationTapAt?: number;
  };
  CreatePath: undefined;
  Path: {
    pathId: number;
    /** Present only for a shared path opened through the group screen. */
    live?: {
      sehajPathId: string;
      driving: boolean;
      /** Present when driving: what `finishReading` needs to end the turn. */
      sessionId?: string;
      startAng?: number;
      /** When the turn began, so the finish summary can report how long. */
      startedAt?: string;
      /** The scheduled booking end, for display context only. */
      slotEndsAt?: string | null;
    };
  };
  Setting: undefined;
  DatabaseUpdate: undefined;
  About: undefined;
  Error: undefined;
  /**
   * The token is the entire payload of an invite link, and it arrives from
   * outside the app — so this screen must assume nothing about being reached
   * with a session, a loaded database, or a warm store.
   */
  JoinPath: { token: string };
  GroupPath: { sehajPathId: string; pathId: number; pathName: string };
  InviteMember: { sehajPathId: string; pathName?: string };
  ChooseSlot: {
    sehajPathId: string;
    pathId: number;
    initialStartsAt?: string;
    initialDurationMinutes?: number;
    slotId?: string;
  };
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

const PushRegistration = () => {
  const authToken = useAppSelector((state) => state.auth.token);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const start = async () => {
      unsubscribe = await registerPushNotifications(authToken);
    };
    start().catch((error) => recordError(error, 'push: startup failed'));
    return () => {
      unsubscribe?.();
    };
  }, [authToken]);
  return null;
};

/**
 * Opens the exact shared path identified by the canonical path UUID carried in
 * the push notification. Display names are never used for routing. The event
 * bridge retains presses received before hydration; returning false keeps an
 * event there until matching group metadata reaches this device.
 */
const PushTapRouter = ({ navigationReady }: { navigationReady: boolean }) => {
  const syncMeta = useAppSelector((state) => state.sync.meta);
  const groupIds = useMemo(
    () =>
      Object.entries(syncMeta)
        .filter(([, meta]) => typeof meta.groupId === 'string' && meta.groupId.length > 0)
        .map(([pathId, meta]) => [meta.groupId as string, Number(pathId)] as const),
    [syncMeta]
  );

  useEffect(
    () =>
      subscribePushTap((event) => {
        if (!isTurnNotificationType(event.type) || !event.pathId) {
          return false;
        }
        const match = groupIds.find(([groupId]) => groupId === event.pathId);
        // On a cold launch Splash owns a delayed transition to Home. Navigating
        // to Continue before that transition finishes makes Splash immediately
        // replace the notification destination with Home. Keep the event in
        // the bridge until navigation has moved beyond Splash.
        if (
          !match ||
          !navigationReady ||
          !pushNavigationRef.isReady() ||
          pushNavigationRef.getCurrentRoute()?.name === undefined ||
          pushNavigationRef.getCurrentRoute()?.name === Routes.Splash
        ) {
          return false;
        }

        const [, pathId] = match;
        // Refresh an already-visible Turns tab before deciding whether the
        // notification also needs to navigate. A newly opened tab fetches its
        // own plan on mount.
        notifyPlanRefresh(event.pathId);
        trackEvent('Notification', 'open', event.type ?? 'turn notification');
        const current = pushNavigationRef.getCurrentRoute();
        if (current?.name === Routes.Continue && current.params?.pathId === pathId) {
          // Native Android notification taps can arrive while this route is
          // already mounted. Updating params directly is reliable on a
          // singleTask activity; navigating to the same route can be treated
          // as a no-op by the native stack.
          pushNavigationRef.setParams({ initialTab: 'turns', notificationTapAt: Date.now() });
        } else {
          pushNavigationRef.navigate(Routes.Continue, {
            pathId,
            sehajPathId: event.pathId,
            initialTab: 'turns',
          });
        }
        return true;
      }),
    [groupIds, navigationReady]
  );

  return null;
};

const App = () => {
  // Push registration is rendered as a child below. Configure the generated
  // client before that child can mount: React runs child effects before the
  // parent effect that used to configure this, which let a cold-start token
  // registration go out with no API base URL or bearer-token getter.
  configureApiClient();
  setTokenGetter(() => Promise.resolve(store.getState().auth.token));

  // null = hydrating, false = failed (fail-closed), true = ready
  const [ready, setReady] = useState<boolean | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);

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

    // Resolve auth: consume a cold-start login callback, else hydrate the
    // stored token (serialized so they can't race).
    initAuth().catch((error) => recordError(error, 'auth: initAuth failed'));

    // One NetInfo subscription for the whole app. On a false→true transition,
    // flush anything queued while offline (Step 10 reconnect trigger).
    let wasOnline = store.getState().network.isOnline;

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      // See `isOnlineFrom`: unknown reachability is not offline.
      const online = isOnlineFrom(state);
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
          <PushRegistration />
          <PushTapRouter navigationReady={navigationReady} />
          <SyncStatusNotice />
          <OfflineDbNotice />
          <SessionExpiredPopup />
          {/* A known-account switch is a data boundary, not only a Home-screen
              prompt. Keep it app-wide so B can never continue editing A's
              active paths from the reader while the switch is unresolved. */}
          <SyncPopup mode="accountSwitch" />
          <NavigationContainer
            ref={pushNavigationRef}
            linking={linking}
            onReady={() => {
              setNavigationReady(true);
              // The initial route is Splash, so the router intentionally keeps
              // a cold-start tap queued. Flush again after later transitions.
              flushPendingPushTaps();
            }}
            onStateChange={flushPendingPushTaps}
          >
            <Stack.Navigator
              initialRouteName={Routes.Splash}
              screenOptions={{
                animation: 'default',
                headerShown: false,
                animationDuration: 250,
                gestureDirection: 'horizontal',
                // Native-stack transitions can briefly expose the navigator
                // beneath the outgoing screen. Keep that surface aligned with
                // the app instead of showing the platform's black default.
                contentStyle: { backgroundColor: UIConstants.SCREEN_BACKGROUND },
              }}
            >
              <Stack.Screen name={Routes.Splash} component={SplashScreen} />
              <Stack.Screen name={Routes.Home} component={HomeScreen} />
              <Stack.Screen name={Routes.Continue} component={Continue} />
              <Stack.Screen name={Routes.CreatePath} component={CreatePath} />
              <Stack.Screen name={Routes.Path} component={PathScreen} />
              <Stack.Screen name={Routes.Setting} component={Settings} />
              <Stack.Screen name={Routes.DatabaseUpdate} component={DatabaseUpdate} />
              <Stack.Screen name={Routes.About} component={About} />
              <Stack.Screen name={Routes.Error} component={Error} />
              <Stack.Screen name={Routes.JoinPath} component={JoinPath} />
              <Stack.Screen name={Routes.GroupPath} component={GroupPath} />
              <Stack.Screen name={Routes.InviteMember} component={InviteMember} />
              <Stack.Screen
                name={Routes.ChooseSlot}
                component={ChooseSlot}
                options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      )}
    </Provider>
  );
};

export default App;
