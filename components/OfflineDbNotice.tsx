import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Constants } from '@constants';
import { DialogStyles as styles } from '@styles';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { dbNoticeShown, type DbCompletion } from '../store/slices/dbSlice';
import { Dialog } from './Dialog';

/** How often to re-attempt a presentation that iOS may have silently dropped. */
const PRESENT_RETRY_MS = 2_000;

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
  /** Bumped to remount the modal when a presentation was silently dropped. */
  const [presentKey, setPresentKey] = useState(0);

  /**
   * Consuming the flag is deliberately tied to the dialog ACTUALLY appearing,
   * not to us asking for it.
   *
   * The download often finishes while the SSO browser is covering the screen,
   * and iOS will not present a modal underneath one. Clearing the flag on
   * request meant the notice was lost for good in exactly that case: on return,
   * `provisionDatabase` sees the database installed and dispatches `dbReady`,
   * which carries no completion, so nothing ever raised it again.
   *
   * Leaving it set costs nothing — `visible` is already true, so the modal
   * presents as soon as the screen is free, and `onShow` clears it then.
   */
  const consume = useCallback(() => {
    dispatch(dbNoticeShown());
  }, [dispatch]);

  const dismiss = useCallback(() => {
    setShown(null);
    // Also clear here: a dialog the user dismissed has served its purpose even
    // if `onShow` never arrived, and a flag left set would replay forever.
    consume();
  }, [consume]);

  useEffect(() => {
    if (completed) {
      setShown(completed);
    }
  }, [completed]);

  /**
   * Keep re-attempting the presentation until it genuinely lands.
   *
   * The download often finishes while the SSO browser is covering the screen.
   * iOS refuses to present a modal underneath one and reports nothing back, so
   * React Native believes it is already showing: `visible` stays true, no state
   * changes, and it never retries once the browser closes.
   *
   * There is no event that means "the screen is free" — the in-app browser is
   * presented INSIDE the app, so `AppState` never leaves `active` and gives no
   * signal at all. Remounting on a timer is therefore the only reliable trigger.
   *
   * This is self-limiting rather than a poll: only `onShow` clears `completed`,
   * so the interval exists exactly while the notice is still owed and tears
   * itself down the moment the dialog has actually been seen.
   */
  useEffect(() => {
    if (!completed) {
      return;
    }
    const timer = setInterval(() => {
      setPresentKey((key) => key + 1);
    }, PRESENT_RETRY_MS);
    return () => clearInterval(timer);
  }, [completed]);

  return (
    <Dialog key={presentKey} visible={shown !== null} onRequestClose={dismiss} onShow={consume}>
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
