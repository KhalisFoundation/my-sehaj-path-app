/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { displayPushMessage } from './utils/pushNotifications';
import App from './App';
import { ErrorBoundary } from './components';
import { name as appName } from './app.json';

messaging().setBackgroundMessageHandler(displayPushMessage);

const AppWithBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

AppRegistry.registerComponent(appName, () => AppWithBoundary);
