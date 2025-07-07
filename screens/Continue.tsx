import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { View, ScrollView, ImageBackground, Text, Pressable, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  NavContent,
  SecondaryButton,
  SimpleText,
  SecondaryHeading,
  ImportantText,
  PathRename,
  Calender,
} from '@components';
import { Constants, ErrorConstants } from '@constants';
import { ContinueScreenStyles, SafeAreaStyle } from '@styles';
import { PathData, useLocal, useInternet } from '@hooks';
import { showErrorAlert } from '@utils';
import { GoBackIcon, ContinueIcon } from '@icons';
import { RootStackParamList } from '../App';

type ContinueProps = NativeStackScreenProps<RootStackParamList, 'Continue'>;

export const Continue = ({ route, navigation }: ContinueProps) => {
  const { pathId } = route.params;
  dayjs.extend(customParseFormat);

  // Consolidated state to reduce re-renders
  const [pathState, setPathState] = useState({
    pathData: undefined as PathData | undefined,
    pathAng: 0,
    pathPercentage: 0,
    daysAgo: 0,
    averageAngs: 0,
    finishDate: undefined as string | undefined,
    showData: false,
    pathName: '',
  });

  const [uiState, setUiState] = useState({
    showPathRename: false,
    tabs: 'progress' as string,
    streakValue: 0,
  });

  const streak = useRef<number>(0);
  const { fetchFromLocal } = useLocal();
  const { checkNetwork, updateOnlineStatus } = useInternet();

  const handleStreakUpdate = useCallback((newStreakValue: number) => {
    setUiState((prev) => ({ ...prev, streakValue: newStreakValue }));
  }, []);

  // Memoized calculation to prevent unnecessary recalculations
  const calculatePathCompletion = useCallback((matchedPath: PathData) => {
    const today = dayjs();
    const startDate = dayjs(matchedPath.startDate, 'D-MMMM-YYYY');
    const days = today.diff(startDate, 'day');
    const averageMatchedAngs = (matchedPath.saveData.angNumber || 0) / (days ? days : 1);

    const remainingAngs = 1430 - matchedPath.saveData.angNumber;
    const remainingDays = remainingAngs / (averageMatchedAngs ? averageMatchedAngs : 1);
    const completionDate = today.add(remainingDays, 'day');

    return {
      finishDate: dayjs(completionDate).format('D-MMMM-YYYY'),
      daysAgo: today.format('D-MMMM-YYYY') === startDate.format('D-MMMM-YYYY') ? 0 : days,
      averageAngs: averageMatchedAngs === Infinity ? 0 : parseFloat(averageMatchedAngs.toFixed(2)),
    };
  }, []);

  const fetchPath = useCallback(async () => {
    try {
      const { pathDataArray } = await fetchFromLocal();
      const matchedPath = pathDataArray.find((path: PathData) => path.pathId === pathId);
      return { matchedPath };
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PATH_DATA, () => navigation.goBack(), 'Retry');
      return { matchedPath: undefined };
    }
  }, [fetchFromLocal, navigation, pathId]);

  const updateTheData = useCallback(async () => {
    try {
      const { matchedPath } = await fetchPath();
      if (matchedPath) {
        const show = matchedPath?.saveData.angNumber < 10 ? false : true;
        const pathAng = matchedPath?.saveData.angNumber || 0;
        const pathPercentage = parseFloat(
          (((matchedPath?.saveData.angNumber || 0) / 1430) * 100).toFixed(2)
        );
        const { finishDate, daysAgo, averageAngs } = calculatePathCompletion(matchedPath);

        setPathState({
          pathData: matchedPath,
          pathAng,
          pathPercentage,
          daysAgo,
          averageAngs,
          finishDate,
          showData: show,
          pathName: matchedPath.pathName,
        });
      }
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_UPDATE_PATH_DATA, () => navigation.goBack(), 'Retry');
    }
  }, [fetchPath, navigation, calculatePathCompletion]);

  useFocusEffect(
    useCallback(() => {
      updateTheData();
    }, [updateTheData])
  );

  const handleContinue = useCallback(async () => {
    try {
      const isConnected = await checkNetwork();
      if (!isConnected) {
        showErrorAlert(
          ErrorConstants.NO_INTERNET_TITLE + '\n' + ErrorConstants.NO_INTERNET_MESSAGE
        );
        return;
      }
      navigation.push('Path', { pathId: pathId });
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_CHECK_NETWORK_CONNECTION);
    }
  }, [checkNetwork, navigation, pathId]);

  useEffect(() => {
    try {
      updateOnlineStatus();
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_CHECK_NETWORK_CONNECTION);
    }
  }, [updateOnlineStatus]);

  // Memoized tab handlers to prevent unnecessary re-renders
  const handleTabPress = useCallback((tab: string) => {
    setUiState((prev) => ({ ...prev, tabs: tab }));
  }, []);

  const handlePathRenamePress = useCallback(() => {
    setUiState((prev) => ({ ...prev, showPathRename: true }));
  }, []);

  const handleBackPress = useCallback(() => {
    navigation.replace('Home');
  }, [navigation]);

  // Memoized progress text to prevent unnecessary re-renders
  const progressText = useMemo(
    () => [
      Constants.YOU_ARE_ON_ANG_NUMBER,
      <ImportantText
        key="ang"
        importantText={`${pathState.pathAng}`}
        importantTextStyles={ContinueScreenStyles.impTextContainer}
      />,
      Constants.HAVE_COMPLETED,
      <ImportantText
        key="percentage"
        importantText={`${pathState.pathPercentage}%`}
        importantTextStyles={ContinueScreenStyles.impTextContainer}
      />,
      Constants.SRI_SEHAJ_PATH,
    ],
    [pathState.pathAng, pathState.pathPercentage]
  );

  const completionText = useMemo(
    () => [
      Constants.STARTED_PATH,
      <ImportantText key="days" importantText={`${pathState.daysAgo} days `} />,
      Constants.AVERAGE_ABOUT,
      <ImportantText key="average" importantText={`${pathState.averageAngs} angs a day. `} />,
      Constants.COMPLETION_SEHAJ_PATH,
      <ImportantText key="finish" importantText={`${pathState.finishDate} 🎯 .`} />,
    ],
    [pathState.daysAgo, pathState.averageAngs, pathState.finishDate]
  );

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <ImageBackground
        source={require('../assets/Images/ContinueScreenBg.png')}
        style={ContinueScreenStyles.backgroundImage}
      >
        <ScrollView
          contentContainerStyle={ContinueScreenStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={ContinueScreenStyles.container}>
            <Pressable
              style={ContinueScreenStyles.navContainer}
              onPress={handleBackPress}
              accessibilityLabel="Back to home"
              accessibilityRole="button"
              accessibilityHint="Tap to go back to home screen"
            >
              <NavContent navIcon={<GoBackIcon />} onPress={handleBackPress} />
              <NavContent text={Constants.SEE_ALL_PATH} />
            </Pressable>
            <View style={ContinueScreenStyles.tabsContainer}>
              <Pressable
                style={uiState.tabs === 'progress' ? ContinueScreenStyles.tabActive : null}
                onPress={() => handleTabPress('progress')}
                onLongPress={() => handleTabPress('progress')}
                accessibilityLabel="Progress tab"
                accessibilityRole="tab"
                accessibilityState={{ selected: uiState.tabs === 'progress' }}
                accessibilityHint="Tap to view progress information"
              >
                <Text style={ContinueScreenStyles.tabText}>Progress</Text>
              </Pressable>
              <Pressable
                style={uiState.tabs === 'streak' ? ContinueScreenStyles.tabActive : null}
                onPress={() => handleTabPress('streak')}
                onLongPress={() => handleTabPress('streak')}
                accessibilityLabel="Streak tab"
                accessibilityRole="tab"
                accessibilityState={{ selected: uiState.tabs === 'streak' }}
                accessibilityHint="Tap to view streak information"
              >
                <Text style={ContinueScreenStyles.tabText}>Streak</Text>
              </Pressable>
            </View>
            {uiState.tabs === 'progress' && (
              <>
                <Pressable
                  style={ContinueScreenStyles.sehajHeadingContainer}
                  onPress={handlePathRenamePress}
                  onLongPress={handlePathRenamePress}
                  accessibilityLabel={`Path name: ${
                    pathState.pathName || pathState.pathData?.pathName
                  }`}
                  accessibilityRole="button"
                  accessibilityHint="Tap to rename this path"
                >
                  <SecondaryHeading
                    text={pathState.pathName || pathState.pathData?.pathName}
                    textStyles={ContinueScreenStyles.sehajHeading}
                  />
                </Pressable>
                <ImportantText
                  importantText={Constants.WAHEGURU_JI_KA_KHALSA_WAHEGURU_JI_KI_FATEH}
                  importantTextStyles={ContinueScreenStyles.waheguruHeading}
                />
              </>
            )}

            {pathState.showData ? (
              <>
                {uiState.tabs === 'progress' && (
                  <>
                    <SimpleText
                      simpleText={progressText}
                      simpleTextStyle={ContinueScreenStyles.textStyle}
                    />
                    <SimpleText simpleText={completionText} />
                  </>
                )}
                {uiState.tabs === 'streak' && (
                  <>
                    <View style={ContinueScreenStyles.streakContainer}>
                      <View style={ContinueScreenStyles.streakValueContainer}>
                        <SecondaryHeading
                          text={uiState.streakValue}
                          textStyles={ContinueScreenStyles.streakText}
                        />
                        <Image
                          source={require('@assets/Images/Streak.png')}
                          style={ContinueScreenStyles.streakIcon}
                        />
                      </View>
                      <Text style={ContinueScreenStyles.streakTagLine}>Current Streak</Text>
                    </View>
                    <Calender pathId={pathId} streak={streak} onStreakUpdate={handleStreakUpdate} />
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={ContinueScreenStyles.complete10Angs}>
                  {Constants.COMPLETE_10_ANGS}
                </Text>
              </>
            )}

            <SecondaryButton
              onPress={handleContinue}
              buttonText={'Continue'}
              buttonIcon={<ContinueIcon />}
              buttonStyle={ContinueScreenStyles.continueButton}
            />
          </View>
        </ScrollView>
      </ImageBackground>
      {uiState.showPathRename && (
        <PathRename
          pathId={pathId}
          setPathRename={(show) => setUiState((prev) => ({ ...prev, showPathRename: show }))}
          setPathName={(name) => setPathState((prev) => ({ ...prev, pathName: name }))}
        />
      )}
    </SafeAreaView>
  );
};
