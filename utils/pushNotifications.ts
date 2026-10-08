import { PermissionsAndroid, Platform } from 'react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus as NotifeeAuthorizationStatus,
  EventType,
} from '@notifee/react-native';
import { pushControllerRegister } from '@api/generated/sdk.gen';
import { recordError } from './crashlytics';
import {
  emitPushTap,
  flushPendingPushTaps,
  subscribePushTap,
  type PushTapEvent,
} from './pushEvents';

const CHANNEL_ID = 'general';
const INITIAL_NOTIFICATION_RETRY_DELAY_MS = 250;
const INITIAL_NOTIFICATION_MAX_RETRIES = 8;

const ensureAndroidNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    return;
  }

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Notifications',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    lights: true,
  });
};

type NotificationData = Record<string, unknown>;

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const normaliseNotificationType = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

/**
 * Android can deliver the notification block separately from the FCM data
 * block. Keep the turn classification tolerant of the casing/key spelling
 * used by older senders, while retaining the canonical event names inside
 * the app.
 */
export const isTurnNotificationType = (value: unknown): boolean => {
  const text = asText(value);
  if (!text) {
    return false;
  }
  const normalised = normaliseNotificationType(text);
  return (
    normalised === 'sehaj-path-turn-updated' ||
    normalised === 'sehaj-path-turn-reminder' ||
    normalised === 'turn-updated' ||
    normalised === 'turn-reminder'
  );
};

/**
 * Fallback for Android system-rendered notifications where a legacy FCM
 * sender omitted notificationType from the delivered data. The turn title is
 * deliberately narrow so unrelated dashboard notifications are unaffected.
 */
const inferTurnNotificationType = (data: NotificationData): string | undefined => {
  const candidates = [data.title, data.body].map(asText).filter(Boolean) as string[];
  const text = candidates.join(' ').toLowerCase();
  if (/sehaj\s+path.*turn.*updated|turn.*updated/.test(text)) {
    return 'sehaj-path-turn-updated';
  }
  if (/sehaj\s+path.*turn.*(coming|start)|turn.*(coming|start)/.test(text)) {
    return 'sehaj-path-turn-reminder';
  }
  return undefined;
};

const createPushTapEvent = (data: NotificationData | undefined, id?: string): PushTapEvent => {
  const normalizedData: Record<string, unknown> = data ?? {};
  const pathId = [
    normalizedData.sehajPathId,
    normalizedData.pathId,
    normalizedData.groupId,
    normalizedData.sehaj_path_id,
    normalizedData.path_id,
  ]
    .map(asText)
    .find((value): value is string => value !== undefined);
  const rawType = [
    normalizedData.type,
    normalizedData.notificationType,
    normalizedData.notification_type,
    normalizedData.notificationtype,
    normalizedData.event,
    normalizedData.kind,
  ]
    .map(asText)
    .find((value): value is string => value !== undefined);
  const type =
    rawType !== undefined && isTurnNotificationType(rawType)
      ? normaliseNotificationType(rawType)
      : rawType ?? inferTurnNotificationType(normalizedData);

  return { id, pathId, type, data: normalizedData };
};

const emitRemoteMessageTap = (message: FirebaseMessagingTypes.RemoteMessage): void => {
  const data = {
    ...(message.data ?? {}),
    ...(message.notification?.title !== undefined && message.data?.title === undefined
      ? { title: message.notification.title }
      : {}),
    ...(message.notification?.body !== undefined && message.data?.body === undefined
      ? { body: message.notification.body }
      : {}),
  };
  emitPushTap(createPushTapEvent(data, message.messageId));
};

let tapHandlersRegistered = false;

/**
 * On an Android cold start, index.js can run before the Activity exposing the
 * notification intent is ready. Firebase reports `null` in that short window.
 * Retry for two seconds so a tap cannot be turned into a plain Home launch.
 */
const readInitialRemoteNotification = (attempt = 0): void => {
  messaging()
    .getInitialNotification()
    .then((message) => {
      if (message !== null) {
        emitRemoteMessageTap(message);
        return;
      }
      if (attempt < INITIAL_NOTIFICATION_MAX_RETRIES) {
        setTimeout(
          () => readInitialRemoteNotification(attempt + 1),
          INITIAL_NOTIFICATION_RETRY_DELAY_MS
        );
      }
    })
    .catch((error) => recordError(error, 'push: initial notification failed'));
};

const readInitialNotifeeNotification = (attempt = 0): void => {
  notifee
    .getInitialNotification()
    .then((initialNotification) => {
      if (initialNotification?.notification !== undefined) {
        emitPushTap(
          createPushTapEvent(
            initialNotification.notification.data,
            initialNotification.notification.id
          )
        );
        return;
      }
      if (attempt < INITIAL_NOTIFICATION_MAX_RETRIES) {
        setTimeout(
          () => readInitialNotifeeNotification(attempt + 1),
          INITIAL_NOTIFICATION_RETRY_DELAY_MS
        );
      }
    })
    .catch((error) => recordError(error, 'push: initial Notifee notification failed'));
};

/**
 * Registers all native notification-open entry points. This is called from
 * index.js so presses are captured even when the app is cold-started, while
 * pushEvents buffers them until the relevant screen is mounted.
 */
export const registerPushNotificationTapHandlers = (): void => {
  if (tapHandlersRegistered) {
    return;
  }
  tapHandlersRegistered = true;

  try {
    messaging().onNotificationOpenedApp(emitRemoteMessageTap);
    readInitialRemoteNotification();
  } catch (error) {
    recordError(error, 'push: notification-open handler registration failed');
  }

  try {
    notifee.onForegroundEvent((event) => {
      if (event.type !== EventType.PRESS && event.type !== EventType.ACTION_PRESS) {
        return;
      }
      const { notification } = event.detail;
      if (notification !== undefined) {
        emitPushTap(createPushTapEvent(notification.data, notification.id));
      }
    });
    readInitialNotifeeNotification();
  } catch (error) {
    recordError(error, 'push: Notifee-open handler registration failed');
  }
};

export { flushPendingPushTaps, subscribePushTap };

export const displayPushMessage = async (
  message: FirebaseMessagingTypes.RemoteMessage
): Promise<void> => {
  try {
    const titleValue = message.data?.title ?? message.notification?.title;
    const bodyValue = message.data?.body ?? message.notification?.body;
    const title = typeof titleValue === 'string' ? titleValue : undefined;
    const body = typeof bodyValue === 'string' ? bodyValue : undefined;
    if (!title && !body) {
      return;
    }

    await ensureAndroidNotificationChannel();

    const androidNotification = () => {
      if (Platform.OS !== 'android') {
        return undefined;
      }
      return {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_sehaj',
        sound: 'default' as const,
        pressAction: { id: 'default' },
      };
    };

    await notifee.displayNotification({
      title: title ?? 'Khalis',
      body: body ?? '',
      data: message.data,
      android: androidNotification(),
      // FCM does not present notification payloads while the app is active.
      // Explicitly request the iOS foreground banner/list and sound so a
      // foreground push is visible on both platforms, not only in the tray
      // after the app is backgrounded.
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          banner: true,
          list: true,
          sound: true,
        },
      },
    });
  } catch (error) {
    // Foreground notification presentation must never interrupt the app.
    recordError(error, 'push: display notification failed');
  }
};

/** Requests permission, registers the current token, and tracks token rotation. */
export const registerPushNotifications = async (authToken?: string | null): Promise<() => void> => {
  try {
    // Android 13+ does not show notifications until the runtime permission is
    // granted. Firebase's iOS-oriented requestPermission API alone does not
    // trigger this Android prompt.
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        return () => undefined;
      }
    }

    // Notifee owns the local notification presentation used by both the
    // foreground handler and the Android channel. Request its permission as
    // well as Firebase's permission; asking Firebase alone can leave the
    // Notifee presentation path denied (especially on iOS).
    const notifeePermission = await notifee.requestPermission();
    if (notifeePermission.authorizationStatus === NotifeeAuthorizationStatus.DENIED) {
      return () => undefined;
    }

    // Create the channel while the app is active, before the first possible
    // background delivery. FCM's OS-rendered notification path cannot create
    // a Notifee channel for us when the app process is suspended.
    await ensureAndroidNotificationChannel();

    const permission = await messaging().requestPermission();
    const allowed =
      Platform.OS === 'android' ||
      permission === messaging.AuthorizationStatus.AUTHORIZED ||
      permission === messaging.AuthorizationStatus.PROVISIONAL;
    if (!allowed) {
      return () => undefined;
    }

    const register = async (token: string): Promise<void> => {
      const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
      const result = await pushControllerRegister({
        // Pass the current SSO token through the generated operation. This is
        // important for the optional-auth device endpoint: an interceptor can
        // run after the SDK has already resolved security, leaving the token
        // registered anonymously and `attachedToUser` false.
        auth: authToken ?? undefined,
        body: {
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          ...(typeof timeZone === 'string' && timeZone.length > 0 ? { timeZone } : {}),
        },
      });

      if (result.error !== undefined || result.data === undefined) {
        const status = 'response' in result ? result.response?.status ?? 0 : 0;
        throw new Error(
          status > 0
            ? `Push device registration failed with HTTP ${status}`
            : 'Push device registration failed'
        );
      }
    };

    await register(await messaging().getToken());
    const unsubscribe = messaging().onTokenRefresh((token) => {
      register(token).catch((error) =>
        recordError(error, 'push: token refresh registration failed')
      );
    });
    return unsubscribe;
  } catch (error) {
    recordError(error, 'push: registration failed');
    return () => undefined;
  }
};
