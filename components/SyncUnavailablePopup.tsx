import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { isApiConfigured } from '@api/config';
import { Constants } from '@constants';
import { DialogStyles as styles } from '@styles';
import { useAppSelector } from '../store/hooks';
import { Dialog } from './Dialog';

/**
 * Shown when this build has no server configured (`SEHAJ_API_URL` missing), so
 * cloud sync cannot run at all. Reading and local saving are unaffected — the
 * point is to say why "Sync now" will not work, instead of letting it fail with
 * a misleading "check your connection" error.
 *
 * Only signed-in users see it: someone who never signed in is not expecting
 * their progress to sync. It appears once per app run and is dismissible, so a
 * misconfigured build never nags a reader.
 */
const SyncUnavailablePopupComponent = () => {
  const [dismissed, setDismissed] = useState(false);
  const status = useAppSelector((state) => state.auth.status);

  const isVisible = !isApiConfigured() && status === 'signedIn' && !dismissed;

  return (
    <Dialog visible={isVisible} onRequestClose={() => setDismissed(true)}>
      <Text style={styles.title}>{Constants.SYNC_UNAVAILABLE_TITLE}</Text>
      <Text style={styles.message}>{Constants.SYNC_UNAVAILABLE_MESSAGE}</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel={Constants.OK}
        >
          <Text style={styles.primaryText}>{Constants.OK}</Text>
        </TouchableOpacity>
      </View>
    </Dialog>
  );
};

export const SyncUnavailablePopup = React.memo(SyncUnavailablePopupComponent);
