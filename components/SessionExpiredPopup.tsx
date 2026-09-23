import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Constants } from '@constants';
import { startLogin } from '@auth';
import { trackEvent } from '@utils';
import { DialogStyles as styles } from '@styles';
import { store } from '../store';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  dismissSessionExpired,
  dismissSignInPopup,
  showSignInPopupAgain,
} from '../store/slices/syncSlice';
import { writeSyncPrefs } from '../store/syncPrefs';
import { isFullyBackedUp } from '../store/syncWork';
import { Dialog } from './Dialog';

const SessionExpiredPopupComponent = () => {
  const dispatch = useAppDispatch();
  const visible = useAppSelector((state) => state.sync.sessionExpired);
  /**
   * The same gate logout uses, so the two can never disagree about whether this
   * device holds reading the server has not seen.
   */
  const backedUp = useAppSelector((state) => isFullyBackedUp(store, state));

  /**
   * Close the notice — and only REMEMBER that choice when nothing is at risk.
   *
   * `signInPopupDismissed` is persisted and re-read at every launch, and the one
   * thing that clears it is an explicit logout (`auth/logout.ts`) — which a
   * signed-out user cannot meaningfully perform. So the write below is not
   * "ask me later", it is "never ask me again", permanently.
   *
   * That is fine for a device whose reading is already on the server. It is not
   * fine for the user who has reading that exists only here: signing out stops
   * the outbox, so every reminder to sign back in is exactly what stands between
   * them and losing it. Closing the popup still works — they simply get asked
   * again next launch rather than never.
   *
   * Note the unsynced branch RE-ARMS rather than merely skipping the write.
   * Skipping is not enough: the flag may already be true from an earlier
   * dismissal of the signed-out sign-in prompt, and leaving it alone is still
   * "never ask again" for exactly the user who most needs asking.
   */
  const dismiss = useCallback(() => {
    // Distinguished by risk: dismissing with everything backed up is harmless,
    // dismissing with reading that exists only here is the choice worth knowing
    // about.
    trackEvent('SessionExpired', 'click', backedUp ? 'not now' : 'not now with unsynced');
    dispatch(dismissSessionExpired());
    if (!backedUp) {
      dispatch(showSignInPopupAgain());
      writeSyncPrefs({ signInPopupDismissed: false });
      return;
    }
    dispatch(dismissSignInPopup());
    writeSyncPrefs({ signInPopupDismissed: true });
  }, [dispatch, backedUp]);

  const login = useCallback(() => {
    trackEvent('SessionExpired', 'click', 'log in again');
    dispatch(dismissSessionExpired());
    // Silence the sign-in prompt for this session, but never persist it.
    //
    // `startLogin` dispatches nothing, so `auth.status` stays 'signedOut' for as
    // long as the browser is open — without this the prompt would appear the
    // instant this notice closes, underneath the auth session. Persisting it
    // would be wrong for the opposite reason: a login the user cancels should
    // still be asked about again.
    dispatch(dismissSignInPopup());
    startLogin();
  }, [dispatch]);

  return (
    <Dialog visible={visible} onRequestClose={dismiss}>
      <Text style={styles.title}>{Constants.SESSION_EXPIRED_TITLE}</Text>
      <Text style={styles.message}>
        {backedUp ? Constants.SESSION_EXPIRED_MESSAGE : Constants.SESSION_EXPIRED_UNSYNCED_MESSAGE}
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel={Constants.NOT_NOW}
        >
          <Text style={styles.secondaryText}>{Constants.NOT_NOW}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={login}
          accessibilityRole="button"
          accessibilityLabel={Constants.LOGIN}
        >
          <Text style={styles.primaryText}>{Constants.LOGIN}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
};

export const SessionExpiredPopup = React.memo(SessionExpiredPopupComponent);
