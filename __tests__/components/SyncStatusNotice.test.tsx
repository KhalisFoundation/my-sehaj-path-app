import React from 'react';
import { Provider } from 'react-redux';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SyncStatusNotice } from '../../components/SyncStatusNotice';
import { makeStore } from '../../store';
import { setSignedIn } from '../../store/slices/authSlice';
import { setOnline } from '../../store/slices/networkSlice';
import { setSyncError } from '../../store/slices/syncSlice';

jest.mock('../../api/config', () => ({ isApiConfigured: () => true }));
jest.mock('../../icons', () => ({
  OfflineCloudIcon: () => null,
  SyncedCheckIcon: () => null,
}));

describe('SyncStatusNotice', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a sync error available when it is hidden by an offline notice', async () => {
    const store = makeStore();
    store.dispatch(
      setSignedIn({ token: 'token', email: 'u@e.com', firstname: 'U', lastname: 'E' })
    );
    store.dispatch(setSyncError('network'));

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <Provider store={store}>
          <SyncStatusNotice />
        </Provider>
      );
    });
    await act(async () => {
      jest.advanceTimersByTime(250); // wait for the status-settle transition
    });

    await act(async () => {
      store.dispatch(setOnline(false));
    });
    expect(
      renderer.root
        .findAllByType(Text)
        .some((node) => node.props.children === 'No internet connection')
    ).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(10_000); // longer than the normal four-second error timeout
    });
    await act(async () => {
      store.dispatch(setOnline(true));
    });

    expect(
      renderer.root
        .findAllByType(Text)
        .some(
          (node) => node.props.children === 'Unable to sync. Your progress is safe on this device.'
        )
    ).toBe(true);
  });
});
