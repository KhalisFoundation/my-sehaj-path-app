import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Constants } from '@constants';
import { DialogStyles as styles } from '@styles';
import { useAppSelector } from '../store/hooks';
import { Dialog } from './Dialog';

export const OfflineDbNotice = () => {
  const status = useAppSelector((state) => state.db.status);
  const sawDownloading = useRef(false);
  const readyAlertShown = useRef(false);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (status === 'downloading') {
      sawDownloading.current = true;
      return;
    }
    if (status === 'ready' && sawDownloading.current && !readyAlertShown.current) {
      readyAlertShown.current = true;
      setVisible(true);
    }
  }, [status]);

  return (
    <Dialog visible={visible} onRequestClose={dismiss}>
      <Text style={styles.title}>Offline reading ready</Text>
      <Text style={styles.message}>
        The reading database has been downloaded. Now you can do path even without internet.
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
