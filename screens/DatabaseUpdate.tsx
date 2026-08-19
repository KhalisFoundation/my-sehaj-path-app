import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavContent } from '@components';
import { LeftArrowIcon } from '@icons';
import { EDGES_ALL_SIDES, DatabaseUpdateText } from '@constants';
import { DatabaseUpdateScreenStyles as styles, SafeAreaStyle } from '@styles';
import { checkForDatabaseUpdate, runDatabaseUpdate } from '../db';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { trackEvent } from '@utils';
import { useAppSelector } from '../store/hooks';

type Props = NativeStackScreenProps<RootStackParamList, 'DatabaseUpdate'>;
type UpdateState =
  | 'checking'
  | 'downloadInProgress'
  | 'updateAvailable'
  | 'updating'
  | 'upToDate'
  | 'updated'
  | 'insufficientStorage'
  | 'offline'
  | 'unavailable'
  | 'checkFailed'
  | 'failed';

const progressMessage = (progress: number, startingMessage: string): string => {
  if (progress >= 100) {
    return DatabaseUpdateText.FINALIZING_MESSAGE;
  }
  return progress > 0 ? DatabaseUpdateText.PROGRESS_MESSAGE(progress) : startingMessage;
};

const copyFor = (state: UpdateState, progress: number): { title: string; message: string } => {
  if (state === 'checking') {
    return {
      title: DatabaseUpdateText.CHECKING_TITLE,
      message: DatabaseUpdateText.CHECKING_MESSAGE,
    };
  }
  if (state === 'downloadInProgress') {
    return {
      title: DatabaseUpdateText.DOWNLOAD_IN_PROGRESS_TITLE,
      message: progressMessage(progress, DatabaseUpdateText.DOWNLOAD_IN_PROGRESS_MESSAGE),
    };
  }
  if (state === 'updateAvailable') {
    return {
      title: DatabaseUpdateText.UPDATE_AVAILABLE_TITLE,
      message: DatabaseUpdateText.UPDATE_AVAILABLE_MESSAGE,
    };
  }
  if (state === 'updating') {
    return {
      title: DatabaseUpdateText.UPDATING_TITLE,
      message: progressMessage(progress, DatabaseUpdateText.UPDATING_START_MESSAGE),
    };
  }
  if (state === 'upToDate') {
    return {
      title: DatabaseUpdateText.UP_TO_DATE_TITLE,
      message: DatabaseUpdateText.UP_TO_DATE_MESSAGE,
    };
  }
  if (state === 'updated') {
    return { title: DatabaseUpdateText.UPDATED_TITLE, message: DatabaseUpdateText.UPDATED_MESSAGE };
  }
  if (state === 'insufficientStorage') {
    return {
      title: DatabaseUpdateText.INSUFFICIENT_STORAGE_TITLE,
      message: DatabaseUpdateText.INSUFFICIENT_STORAGE_MESSAGE,
    };
  }
  if (state === 'offline') {
    return {
      title: DatabaseUpdateText.OFFLINE_TITLE,
      message: DatabaseUpdateText.OFFLINE_MESSAGE,
    };
  }
  if (state === 'unavailable') {
    return {
      title: DatabaseUpdateText.UNAVAILABLE_TITLE,
      message: DatabaseUpdateText.UNAVAILABLE_MESSAGE,
    };
  }
  if (state === 'checkFailed') {
    return {
      title: DatabaseUpdateText.CHECK_FAILED_TITLE,
      message: DatabaseUpdateText.CHECK_FAILED_MESSAGE,
    };
  }
  return { title: DatabaseUpdateText.FAILED_TITLE, message: DatabaseUpdateText.FAILED_MESSAGE };
};

export const DatabaseUpdate = ({ navigation }: Props) => {
  useScreenAnalytics('DatabaseUpdate', 'DatabaseUpdate');
  const [state, setState] = useState<UpdateState>('checking');
  const [progress, setProgress] = useState(0);
  const databaseStatus = useAppSelector((store) => store.db.status);
  const databaseProgress = useAppSelector((store) => store.db.progress);
  const isOnline = useAppSelector((store) => store.network.isOnline);
  const wasDownloadingRef = useRef(false);
  /** True while THIS screen is driving an update it started. */
  const selfUpdating = useRef(false);

  // Check only — never downloads. If an update exists we ask the user first.
  const runCheck = useCallback(async () => {
    setState('checking');
    setProgress(0);
    const result = await checkForDatabaseUpdate();
    if (result.status === 'up-to-date') {
      setState('upToDate');
    } else if (result.status === 'update-available') {
      setState('updateAvailable');
    } else if (result.status === 'not-configured') {
      setState('unavailable');
    } else {
      // `checkForDatabaseUpdate` already reported this with the original error
      // and its stack. Reporting again here only duplicated the issue with a
      // message-only Error.
      setState('checkFailed');
    }
  }, []);

  // Only the button is a user action — `runCheck` also runs automatically when
  // the screen mounts, and that is not something the user chose to do.
  const onCheckAgain = useCallback(() => {
    selfUpdating.current = false;
    trackEvent('DatabaseUpdate', 'click', 'check for update');
    runCheck();
  }, [runCheck]);

  // Runs only when the user confirms via the "Update now" button.
  const startUpdate = useCallback(async () => {
    // NetInfo can update between rendering the button and handling its tap.
    // Never start a known-offline request; reconnect provisioning owns resume.
    if (!isOnline) {
      return;
    }
    // While this screen owns the update, its own result must not be replaced by
    // the mount check reacting to the same status changes.
    selfUpdating.current = true;
    trackEvent('DatabaseUpdate', 'click', 'update now');
    setState('updating');
    setProgress(0);
    const result = await runDatabaseUpdate(({ percent }) => setProgress(percent));
    if (result.status === 'updated') {
      setState('updated');
    } else if (result.status === 'not-configured') {
      setState('unavailable');
    } else if (result.status === 'insufficient-storage') {
      // Keep this inside the status card. The persisted block prevents boot,
      // reconnect, and foreground hooks from repeatedly trying in the background.
      setState('insufficientStorage');
    } else {
      // The download layer already reported this, classified by failure kind.
      // A second report here duplicated every manual-update failure.
      // Release screen ownership so a reconnect-triggered background resume is
      // reflected here as soon as Redux returns to `downloading`.
      selfUpdating.current = false;
      setState('failed');
    }
    // Keep ownership after showing the result so the Redux status change caused
    // by this same attempt cannot immediately replace the card with `runCheck`.
  }, [isOnline]);

  useEffect(() => {
    // The rendered offline state has no actions. Wait for the NetInfo reconnect
    // edge before checking the MD5 or reacting to the download lifecycle.
    if (!isOnline) {
      return;
    }
    if (selfUpdating.current) {
      return; // this screen started the update and is already reporting it
    }
    // A download started elsewhere (boot provisioning, or an update begun before
    // the user navigated away and came back) is still running. Show THAT instead
    // of checking again and offering an update that is already downloading.
    if (databaseStatus === 'downloading') {
      wasDownloadingRef.current = true;
      setProgress(databaseProgress);
      setState('downloadInProgress');
      return;
    }
    if (wasDownloadingRef.current) {
      wasDownloadingRef.current = false;
    }
    runCheck();
  }, [runCheck, databaseProgress, databaseStatus, isOnline]);

  const displayState: UpdateState = isOnline ? state : 'offline';
  const copy = copyFor(displayState, progress);
  const isBusy =
    displayState === 'checking' ||
    displayState === 'downloadInProgress' ||
    displayState === 'updating';
  const showCheckAgain =
    !isBusy &&
    displayState !== 'offline' &&
    displayState !== 'updateAvailable' &&
    displayState !== 'insufficientStorage';

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <View style={styles.container}>
        <View style={styles.navContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={DatabaseUpdateText.BACK}
          >
            <NavContent
              navIcon={<LeftArrowIcon color="#fff" />}
              onPress={() => navigation.goBack()}
            />
            <Text style={styles.navText}>{DatabaseUpdateText.NAV_TITLE}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Image source={require('../assets/Images/BaniDB.png')} style={styles.logo} />
          <Text style={styles.subtitle}>{DatabaseUpdateText.SUBTITLE}</Text>
          <View style={styles.statusCard}>
            {isBusy && <ActivityIndicator size="small" color="#11336A" />}
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.message}>{copy.message}</Text>
            {(displayState === 'updateAvailable' || displayState === 'insufficientStorage') && (
              <TouchableOpacity
                style={styles.button}
                onPress={startUpdate}
                accessibilityRole="button"
                accessibilityLabel={
                  displayState === 'insufficientStorage'
                    ? DatabaseUpdateText.TRY_AGAIN_STORAGE_A11Y
                    : DatabaseUpdateText.UPDATE_NOW
                }
              >
                <Text style={styles.buttonText}>
                  {displayState === 'insufficientStorage'
                    ? DatabaseUpdateText.TRY_AGAIN
                    : DatabaseUpdateText.UPDATE_NOW}
                </Text>
              </TouchableOpacity>
            )}
            {showCheckAgain && (
              <TouchableOpacity
                style={styles.button}
                onPress={onCheckAgain}
                accessibilityRole="button"
                accessibilityLabel={DatabaseUpdateText.CHECK_UPDATE_A11Y}
              >
                <Text style={styles.buttonText}>{DatabaseUpdateText.CHECK_AGAIN}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
