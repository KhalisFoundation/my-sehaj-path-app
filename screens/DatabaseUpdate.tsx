import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavContent } from '@components';
import { LeftArrowIcon } from '@icons';
import { EDGES_ALL_SIDES, DatabaseUpdateText } from '@constants';
import { DatabaseUpdateScreenStyles as styles, SafeAreaStyle } from '@styles';
import { checkForDatabaseUpdate, performDatabaseUpdate } from '../db';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { useAppSelector } from '../store/hooks';

type Props = NativeStackScreenProps<RootStackParamList, 'DatabaseUpdate'>;
type UpdateState =
  | 'checking'
  | 'downloadInProgress'
  | 'updateAvailable'
  | 'updating'
  | 'upToDate'
  | 'updated'
  | 'unavailable'
  | 'checkFailed'
  | 'failed';

const copyFor = (state: UpdateState, progress: number): { title: string; message: string } => {
  if (state === 'checking') {
    return { title: DatabaseUpdateText.checkingTitle, message: DatabaseUpdateText.checkingMessage };
  }
  if (state === 'downloadInProgress') {
    return {
      title: DatabaseUpdateText.downloadInProgressTitle,
      message:
        progress > 0
          ? DatabaseUpdateText.progressMessage(progress)
          : DatabaseUpdateText.downloadInProgressMessage,
    };
  }
  if (state === 'updateAvailable') {
    return {
      title: DatabaseUpdateText.updateAvailableTitle,
      message: DatabaseUpdateText.updateAvailableMessage,
    };
  }
  if (state === 'updating') {
    return {
      title: DatabaseUpdateText.updatingTitle,
      message:
        progress > 0
          ? DatabaseUpdateText.progressMessage(progress)
          : DatabaseUpdateText.updatingStartMessage,
    };
  }
  if (state === 'upToDate') {
    return {
      title: DatabaseUpdateText.upToDateTitle,
      message: DatabaseUpdateText.upToDateMessage,
    };
  }
  if (state === 'updated') {
    return { title: DatabaseUpdateText.updatedTitle, message: DatabaseUpdateText.updatedMessage };
  }
  if (state === 'unavailable') {
    return {
      title: DatabaseUpdateText.unavailableTitle,
      message: DatabaseUpdateText.unavailableMessage,
    };
  }
  if (state === 'checkFailed') {
    return {
      title: DatabaseUpdateText.checkFailedTitle,
      message: DatabaseUpdateText.checkFailedMessage,
    };
  }
  return { title: DatabaseUpdateText.failedTitle, message: DatabaseUpdateText.failedMessage };
};

export const DatabaseUpdate = ({ navigation }: Props) => {
  useScreenAnalytics('DatabaseUpdate', 'DatabaseUpdate');
  const [state, setState] = useState<UpdateState>('checking');
  const [progress, setProgress] = useState(0);
  const databaseStatus = useAppSelector((store) => store.db.status);
  const databaseProgress = useAppSelector((store) => store.db.progress);
  const wasDownloadingRef = useRef(false);

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
      setState('checkFailed');
    }
  }, []);

  // Runs only when the user confirms via the "Update now" button.
  const startUpdate = useCallback(async () => {
    setState('updating');
    setProgress(0);
    const result = await performDatabaseUpdate(({ percent }) => setProgress(percent));
    if (result.status === 'updated') {
      setState('updated');
    } else if (result.status === 'not-configured') {
      setState('unavailable');
    } else {
      setState('failed');
    }
  }, []);

  useEffect(() => {
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
  }, [runCheck, databaseProgress, databaseStatus]);

  const copy = copyFor(state, progress);
  const isBusy = state === 'checking' || state === 'downloadInProgress' || state === 'updating';

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <View style={styles.container}>
        <View style={styles.navContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel={DatabaseUpdateText.back}
          >
            <NavContent
              navIcon={<LeftArrowIcon color="#fff" />}
              onPress={() => navigation.goBack()}
            />
            <Text style={styles.navText}>{DatabaseUpdateText.navTitle}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Image source={require('../assets/Images/BaniDB.png')} style={styles.logo} />
          <Text style={styles.subtitle}>{DatabaseUpdateText.subtitle}</Text>
          <View style={styles.statusCard}>
            {isBusy && <ActivityIndicator size="small" color="#11336A" />}
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.message}>{copy.message}</Text>
            {state === 'updateAvailable' && (
              <TouchableOpacity
                style={styles.button}
                onPress={startUpdate}
                accessibilityRole="button"
                accessibilityLabel={DatabaseUpdateText.updateNow}
              >
                <Text style={styles.buttonText}>{DatabaseUpdateText.updateNow}</Text>
              </TouchableOpacity>
            )}
            {!isBusy && state !== 'updateAvailable' && (
              <TouchableOpacity
                style={styles.button}
                onPress={runCheck}
                accessibilityRole="button"
                accessibilityLabel={DatabaseUpdateText.checkUpdateA11y}
              >
                <Text style={styles.buttonText}>{DatabaseUpdateText.checkAgain}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
