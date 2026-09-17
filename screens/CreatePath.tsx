import React, { useCallback, useRef, useState } from 'react';
import { Alert, ImageBackground, ScrollView, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text, AppTextInput } from '../components/AppText';
import { BackButton } from '@components';
import { Constants, EDGES_ALL_SIDES, ErrorConstants, Routes, UIConstants } from '@constants';
import { CreatePathStyles as styles, SafeAreaStyle } from '@styles';
import { createPath } from '../store/commands';
import { recordError, showErrorAlert, trackEvent } from '@utils';
import type { RootStackParamList } from '../App';
import { useAppSelector } from '../store/hooks';
import { selectVisiblePaths } from '../store/selectors';
import { getNextDefaultPathNumber } from '../store/slices/pathsSlice';
import { HomeScreenBackground } from '../assets/Images';
import { startLogin } from '@auth';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePath'>;

/** Collects the name before creating a new local path. */
export const CreatePath = ({ navigation }: Props) => {
  const paths = useAppSelector(selectVisiblePaths);
  const isSignedIn = useAppSelector((state) => state.auth.status === 'signedIn');
  const defaultName = `Path #${getNextDefaultPathNumber(paths)}`;
  const [name, setName] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);

  const createAndOpen = useCallback(
    async (initialTab?: 'members') => {
      if (creatingRef.current) {
        return;
      }
      creatingRef.current = true;
      setCreating(true);

      try {
        const pathId = await createPath(name ?? defaultName);
        if (pathId === null) {
          showErrorAlert(ErrorConstants.FAILED_TO_CREATE_NEW_SEHAJ_PATH);
          return;
        }

        trackEvent('PathCreated', 'click', 'start new path');
        navigation.replace(Routes.Continue, initialTab ? { pathId, initialTab } : { pathId });
      } catch (error) {
        recordError(error, 'CreatePath: failed to create path');
        showErrorAlert(ErrorConstants.FAILED_TO_CREATE_NEW_SEHAJ_PATH);
      } finally {
        creatingRef.current = false;
        setCreating(false);
      }
    },
    [defaultName, name, navigation]
  );

  const handleContinue = useCallback(() => createAndOpen(), [createAndOpen]);
  const handleAddMember = useCallback(() => {
    if (!isSignedIn) {
      Alert.alert(
        Constants.CREATE_PATH_ADD_MEMBER_LOGIN_TITLE,
        Constants.CREATE_PATH_ADD_MEMBER_LOGIN_MESSAGE,
        [
          { text: Constants.CANCEL, style: 'cancel' },
          {
            text: Constants.LOGIN,
            onPress: () => {
              startLogin().catch((error: unknown) => {
                recordError(error, 'CreatePath: login from add-member prompt failed');
              });
            },
          },
        ]
      );
      return;
    }
    createAndOpen('members').catch(() => undefined);
  }, [createAndOpen, isSignedIn]);

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <ImageBackground source={HomeScreenBackground} resizeMode="cover" style={styles.background}>
        <View style={styles.screen}>
          <BackButton
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            color={UIConstants.PRIMARY_COLOR}
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.content}>
              <Text style={styles.title}>{Constants.START_A_PATH_TITLE}</Text>
              <Text style={styles.subtitle}>{Constants.CREATE_PATH_SUBTITLE}</Text>

              <AppTextInput
                value={name ?? defaultName}
                onChangeText={setName}
                placeholder={Constants.PATH_NAME_PLACEHOLDER}
                placeholderTextColor={UIConstants.INPUT_PLACEHOLDER_COLOR}
                multiline
                accessibilityLabel={Constants.PATH_NAME_INPUT_LABEL}
                style={styles.input}
                editable={!creating}
              />

              <TouchableOpacity
                onPress={handleContinue}
                disabled={creating}
                accessibilityLabel={Constants.CONTINUE}
                accessibilityRole="button"
                accessibilityState={{ disabled: creating }}
                style={[styles.continueButton, creating && styles.disabledButton]}
              >
                <Text style={styles.continueText}>
                  {creating ? Constants.CREATING : Constants.CONTINUE}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleAddMember}
                disabled={creating}
                accessibilityLabel={Constants.ADD_MEMBERS}
                accessibilityRole="button"
                accessibilityState={{ disabled: creating }}
                style={[styles.addMemberButton, creating && styles.disabledButton]}
              >
                <Text style={styles.addMemberText}>
                  {creating ? Constants.CREATING : Constants.ADD_MEMBERS}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};
