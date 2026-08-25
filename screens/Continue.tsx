import React, { useCallback, useRef, useState, useMemo } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { View, ScrollView, ImageBackground, Pressable, Image } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import {
  NavContent,
  SecondaryButton,
  SimpleText,
  SecondaryHeading,
  ImportantText,
  PathRename,
  PathOptionsMenu,
  Calender,
} from '@components';
import { Constants, EDGES_ALL_SIDES, ErrorConstants, Routes, PATH_DATA } from '@constants';
import { ContinueScreenStyles, SafeAreaStyle } from '@styles';
import { PathData, useScreenAnalytics } from '@hooks';
import { showErrorAlert, trackEvent } from '@utils';
import { useAppSelector } from '../store/hooks';
import { selectVisiblePaths } from '../store/selectors';
import { LeftArrowIcon, ContinueIcon } from '@icons';
import { RootStackParamList } from '../App';

type ContinueProps = NativeStackScreenProps<RootStackParamList, 'Continue'>;

export const Continue = ({ route, navigation }: ContinueProps) => {
  const { pathId, initialTab } = route.params;
  dayjs.extend(customParseFormat);
  useScreenAnalytics('Continue', 'Continue');
  const [pathState, setPathState] = useState({
    pathData: {
      pathId: 0,
      saveData: { angNumber: 0, verseId: 0 },
      progress: 0,
      startDate: '',
      completionDate: '',
      pathName: '',
    },
    pathAng: 0,
    pathPercentage: 0,
    daysAgo: 0,
    averageAngs: 0,
    finishDate: '',
    showData: false,
    pathName: '',
  });

  const [uiState, setUiState] = useState({
    showPathRename: false,
    tabs: initialTab || 'progress',
    streakValue: 0,
  });

  const streak = useRef<number>(0);
  /** Set while a delete is in flight, so the path vanishing is not an error. */
  const isDeletingRef = useRef<boolean>(false);
  const matchedPath = useAppSelector((state) =>
    selectVisiblePaths(state).find((path: PathData) => path.pathId === pathId)
  );
  const previousRoute = useNavigationState((state) => state.routes[state.index - 1]?.name);
  const isFromPath = previousRoute === Routes.Path;

  const handleStreakUpdate = useCallback((newStreakValue: number) => {
    setUiState((prev) => ({ ...prev, streakValue: newStreakValue }));
  }, []);

  const calculatePathCompletion = useCallback((path: PathData) => {
    const today = dayjs();
    const startDate = dayjs(path.startDate, 'D-MMMM-YYYY');
    const days = today.diff(startDate, 'day');
    const averageMatchedAngs = (path.saveData.angNumber || 0) / (days ? days : 1);

    const remainingAngs = PATH_DATA.LAST_ANG_NUMBER - path.saveData.angNumber;
    const remainingDays = remainingAngs / (averageMatchedAngs ? averageMatchedAngs : 1);
    const completionDate = today.add(remainingDays, 'day');

    return {
      finishDate: dayjs(completionDate).format('D-MMMM-YYYY'),
      daysAgo: today.format('D-MMMM-YYYY') === startDate.format('D-MMMM-YYYY') ? 0 : days,
      averageAngs: averageMatchedAngs === Infinity ? 0 : parseFloat(averageMatchedAngs.toFixed(2)),
    };
  }, []);

  const updateTheData = useCallback(() => {
    if (!matchedPath) {
      // A path the user just deleted is SUPPOSED to disappear. Reporting that as
      // a failed load told them the delete had gone wrong when it had worked.
      if (isDeletingRef.current) {
        return;
      }
      showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PATH_DATA, () => navigation.goBack(), 'Retry');
      return;
    }
    const pathAng = matchedPath.saveData.angNumber || 0;
    const pathPercentage = parseFloat(((pathAng / PATH_DATA.LAST_ANG_NUMBER) * 100).toFixed(2));
    const { finishDate, daysAgo, averageAngs } = calculatePathCompletion(matchedPath);

    setPathState({
      pathData: matchedPath,
      pathAng,
      pathPercentage,
      daysAgo,
      averageAngs,
      finishDate,
      showData: pathAng >= 10,
      pathName: matchedPath.pathName,
    });
  }, [matchedPath, navigation, calculatePathCompletion]);

  useFocusEffect(updateTheData);

  // The reader content is bundled with the app, so Continue must work fully
  // offline. Network state only affects cloud sync, never opening a path.
  const handleContinue = useCallback(() => {
    navigation.push('Path', { pathId: pathId });
  }, [navigation, pathId]);

  const handleTabPress = useCallback((tab: string) => {
    trackEvent('TabSwitch', 'click', `switch to ${tab} tab`);
    setUiState((prev) => ({ ...prev, tabs: tab }));
  }, []);

  const handlePathRenamePress = useCallback(() => {
    setUiState((prev) => ({ ...prev, showPathRename: true }));
  }, []);

  const handleBackPress = useCallback(() => {
    if (isFromPath) {
      navigation.goBack();
      return;
    }

    navigation.replace(Routes.Home);
  }, [navigation, isFromPath]);

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
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <ImageBackground
        source={require('../assets/Images/ContinueScreenBg.png')}
        style={ContinueScreenStyles.backgroundImage}
      >
        <ScrollView
          contentContainerStyle={ContinueScreenStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={ContinueScreenStyles.container}>
            <View style={ContinueScreenStyles.navRow}>
              <Pressable
                style={ContinueScreenStyles.navContainer}
                onPress={handleBackPress}
                accessibilityLabel={isFromPath ? Constants.BACK_TO_PATH : 'Back to home'}
                accessibilityRole="button"
                accessibilityHint={
                  isFromPath ? 'Tap to go back to the path screen' : 'Tap to go back to home screen'
                }
              >
                <NavContent navIcon={<LeftArrowIcon />} onPress={handleBackPress} />
                <NavContent text={isFromPath ? Constants.BACK_TO_PATH : Constants.SEE_ALL_PATH} />
              </Pressable>
              {matchedPath ? (
                <PathOptionsMenu
                  pathId={pathId}
                  pathName={pathState.pathName || pathState.pathData?.pathName || ''}
                  // Always Home, never `goBack`: coming from the reader, back
                  // would return to a path that no longer exists.
                  onDeleted={() =>
                    navigation.replace(Routes.Home, {
                      deletedPathName: pathState.pathName || pathState.pathData?.pathName || '',
                    })
                  }
                  onDeletingChange={(deleting) => {
                    isDeletingRef.current = deleting;
                  }}
                />
              ) : null}
            </View>
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
                    text={pathState.pathName || pathState.pathData?.pathName || ''}
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
                          text={uiState.streakValue.toString()}
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
              buttonIconStyle={ContinueScreenStyles.continueButtonIcon}
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
