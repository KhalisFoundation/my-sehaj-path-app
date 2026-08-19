import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App, { isNetInfoOnline } from '../App';

test('treats pending internet reachability as online until NetInfo reports a failure', () => {
  expect(isNetInfoOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
  expect(isNetInfoOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  expect(isNetInfoOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
