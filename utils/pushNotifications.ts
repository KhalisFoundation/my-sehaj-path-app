import { PermissionsAndroid, Platform } from 'react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import { pushControllerRegister } from '@api/generated/sdk.gen';
import { recordError } from './crashlytics';

const CHANNEL_ID = 'general';

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

    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Notifications',
        importance: AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    const androidNotification = () => {
      if (Platform.OS !== 'android') {
        return undefined;
      }
      return {
        channelId: CHANNEL_ID,
        sound: 'default' as const,
        pressAction: { id: 'default' },
      };
    };

    await notifee.displayNotification({
      title: title ?? 'Khalis',
      body: body ?? '',
      data: message.data,
      android: androidNotification(),
    });
  } catch (error) {
    // Background handlers must resolve even when the native notification API fails.
    recordError(error, 'push: display notification failed');
  }
};

/** Requests permission, registers the current token, and tracks token rotation. */
export const registerPushNotifications = async (): Promise<() => void> => {
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
      await pushControllerRegister({
        body: {
          token,
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          ...(typeof timeZone === 'string' && timeZone.length > 0 ? { timeZone } : {}),
        },
      });
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
