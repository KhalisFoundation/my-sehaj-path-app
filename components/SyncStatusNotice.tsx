import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SyncStatusNoticeStyles as styles } from '@styles';
import { useAppSelector } from '../store/hooks';

/** Small, non-blocking feedback for automatic outbox work. */
const SyncStatusNoticeComponent = () => {
  // This floats above the whole app, outside any SafeAreaView, so it has to
  // offset itself past the status bar / notch or it renders underneath them.
  const insets = useSafeAreaInsets();
  const status = useAppSelector((state) => state.sync.status);
  const lastError = useAppSelector((state) => state.sync.lastError);
  const pendingCount = useAppSelector(
    (state) =>
      Object.keys(state.sync.pathOps).length +
      Object.keys(state.sync.scrollDirty).length +
      (state.sync.pendingSettingsUpdatedAt == null ? 0 : 1)
  );
  const accountMatches = useAppSelector(
    (state) => !!state.auth.email && state.sync.account === state.auth.email
  );
  const sawFlush = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (status === 'flushing') {
      sawFlush.current = true;
      setMessage(null);
      return undefined;
    }

    if (status === 'error') {
      sawFlush.current = false;
      setIsError(true);
      setMessage(
        lastError === 'network'
          ? 'Unable to reach the server. Your progress is safe on this device.'
          : 'Some progress could not be synced. Your local progress is safe.'
      );
    } else if (sawFlush.current && pendingCount === 0 && accountMatches) {
      sawFlush.current = false;
      setIsError(false);
      setMessage('Your progress is synced.');
    }
    return undefined;
  }, [accountMatches, lastError, pendingCount, status]);

  useEffect(() => {
    if (!message) {
      return undefined;
    }
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.notice, { top: insets.top + 12 }, isError && styles.errorNotice]}
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

export const SyncStatusNotice = React.memo(SyncStatusNoticeComponent);
