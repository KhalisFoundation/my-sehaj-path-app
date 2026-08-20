import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavContent } from '@components';
import { LeftArrowIcon } from '@icons';
import { EDGES_ALL_SIDES, DatabaseUpdateText } from '@constants';
import { DatabaseUpdateScreenStyles as styles, SafeAreaStyle } from '@styles';
import {
  checkForDatabaseUpdate,
  isDatabaseDownloadBlockedByStorage,
  runDatabaseUpdate,
} from '../db';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { trackEvent } from '@utils';
import { useAppSelector } from '../store/hooks';

type Props = NativeStackScreenProps<RootStackParamList, 'DatabaseUpdate'>;
type UpdateState =
  | 'idle'
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

const copyFor = (state: UpdateState, hasDatabase: boolean): { title: string; message: string } => {
  if (state === 'idle' && hasDatabase) {
    return { title: DatabaseUpdateText.IDLE_TITLE, message: DatabaseUpdateText.IDLE_MESSAGE };
  }
  if (state === 'idle') {
    return {
      title: DatabaseUpdateText.IDLE_MISSING_TITLE,
      message: DatabaseUpdateText.IDLE_MISSING_MESSAGE,
    };
  }
  if (state === 'checking') {
    return {
      title: DatabaseUpdateText.CHECKING_TITLE,
      message: DatabaseUpdateText.CHECKING_MESSAGE,
    };
  }
  if (state === 'downloadInProgress') {
    return {
      title: DatabaseUpdateText.DOWNLOAD_IN_PROGRESS_TITLE,
      message: DatabaseUpdateText.DOWNLOAD_IN_PROGRESS_MESSAGE,
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
      message: DatabaseUpdateText.UPDATING_START_MESSAGE,
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
  const [state, setState] = useState<UpdateState>('idle');
  const databaseStatus = useAppSelector((store) => store.db.status);
  const isOnline = useAppSelector((store) => store.network.isOnline);
  const wasDownloadingRef = useRef(false);
  /** True while THIS screen is driving an update it started. */
  const selfUpdating = useRef(false);

  // Check only — never downloads. If an update exists we ask the user first.
  const runCheck = useCallback(async () => {
    setState('checking');
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
    const result = await runDatabaseUpdate();
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

  // A previous attempt ran out of space. That is the one thing worth saying
  // BEFORE the user acts: otherwise they tap Download, wait out a 181 MB
  // transfer, and only then learn there was never room for it. Reading the
  // persisted flag is a local lookup, not a network call, so it does not
  // reintroduce the automatic check this screen deliberately dropped.
  useEffect(() => {
    let cancelled = false;
    const showStorageBlockIfSet = async () => {
      if (await isDatabaseDownloadBlockedByStorage()) {
        if (!cancelled) {
          setState((current) => (current === 'idle' ? 'insufficientStorage' : current));
        }
      }
    };
    showStorageBlockIfSet();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setState('downloadInProgress');
      return;
    }
    if (wasDownloadingRef.current) {
      // A download this screen was watching has finished; show its outcome
      // rather than sitting on the idle card.
      wasDownloadingRef.current = false;
      runCheck();
    }
    // Otherwise do NOTHING. Opening this screen used to fire an MD5 request on
    // every visit, which costs a network round trip for a question the user did
    // not ask. They tap "Check for updates" when they want to know.
  }, [runCheck, databaseStatus, isOnline]);

  const displayState: UpdateState = isOnline ? state : 'offline';
  const hasDatabase = databaseStatus === 'ready';
  // "Check again" only makes sense once something has been checked; on a device
  // with no database the action is a download, not a check.
  let checkLabel: string = DatabaseUpdateText.CHECK_AGAIN;
  if (!hasDatabase) {
    // Nothing has been downloaded yet, so the action is a download, not a check.
    checkLabel = DatabaseUpdateText.DOWNLOAD_NOW;
  } else if (displayState === 'idle') {
    // "Check again" reads oddly before anything has been checked.
    checkLabel = DatabaseUpdateText.CHECK_UPDATES;
  }
  const copy = copyFor(displayState, hasDatabase);
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
                onPress={hasDatabase ? onCheckAgain : startUpdate}
                accessibilityRole="button"
                accessibilityLabel={
                  hasDatabase
                    ? DatabaseUpdateText.CHECK_UPDATE_A11Y
                    : DatabaseUpdateText.DOWNLOAD_NOW
                }
              >
                <Text style={styles.buttonText}>{checkLabel}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
