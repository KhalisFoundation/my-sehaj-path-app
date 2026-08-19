import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Constants } from '@constants';
import { DialogStyles as styles } from '@styles';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { dbNoticeShown, type DbCompletion } from '../store/slices/dbSlice';
import { Dialog } from './Dialog';

export const OfflineDbNotice = () => {
  /**
   * Driven by an explicit completion, never by the `downloading -> ready`
   * transition. A FAILED update also ends at `ready` — correctly, since the
   * previous database is untouched — so inferring from status announced a
   * download that never happened, directly beside "Unable to update database".
   */
  const completed = useAppSelector((state) => state.db.completed);
  const dispatch = useAppDispatch();
  const [shown, setShown] = useState<DbCompletion | null>(null);

  const dismiss = useCallback(() => setShown(null), []);

  useEffect(() => {
    if (completed) {
      setShown(completed);
      // Consume it so returning to this screen cannot replay the notice.
      dispatch(dbNoticeShown());
    }
  }, [completed, dispatch]);

  return (
    <Dialog visible={shown !== null} onRequestClose={dismiss}>
      <Text style={styles.title}>
        {shown === 'updated' ? 'Database updated' : 'Offline reading ready'}
      </Text>
      <Text style={styles.message}>
        {shown === 'updated'
          ? 'The reading database has been updated to the latest version.'
          : 'The reading database has been downloaded. Now you can do path even without internet.'}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={Constants.OK}
        >
          <Text style={styles.primaryText}>{Constants.OK}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
};
