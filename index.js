/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { displayPushMessage, registerPushNotificationTapHandlers } from './utils/pushNotifications';
import App from './App';
import { ErrorBoundary } from './components';
import { name as appName } from './app.json';

registerPushNotificationTapHandlers();

// Register at process startup so foreground delivery is not lost while React
// is hydrating or remounting its authenticated tree.
messaging().onMessage(displayPushMessage);

// The API sends normal notification payloads. iOS and Android render those
// while the app is backgrounded, so drawing a second Notifee notification from
// a background message handler produces duplicate alerts. Notification presses
// are captured above through Firebase's opened-app/initial-notification APIs.

const AppWithBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

AppRegistry.registerComponent(appName, () => AppWithBoundary);
