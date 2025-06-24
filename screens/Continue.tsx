import { View, ScrollView, ImageBackground, Text, Pressable } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
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
import { Constants } from '@constants';
import { ContinueScreenStyles, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { GoBackIcon, ContinueIcon } from '@icons';
import { useLocal, PathData } from '../hooks/useLocal';
import { useInternet } from '../hooks/useInternet';

type ContinueProps = NativeStackScreenProps<RootStackParamList, 'Continue'>;

export const Continue = ({ route, navigation }: ContinueProps) => {
  const { pathId } = route.params;
  dayjs.extend(customParseFormat);
  const [pathData, setPathData] = useState<PathData>();
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathPercentage, setPathPercentage] = useState<number>(0);
  const [daysAgo, setDaysAgo] = useState<number>(0);
  const [averageAngs, setAverageAngs] = useState<number>(0);
  const [finishDate, setFinishDate] = useState<string>();
  const [showData, setShowData] = useState<boolean>();
  const [showPathRename, setShowPathRename] = useState<boolean>(false);
  const [tabs, setTabs] = useState<string>('progress');
  const [pathName, setPathName] = useState<string>('');
  const [streakValue, setStreakValue] = useState<number>(0);
  const streak = useRef(0);
  const { fetchFromLocal } = useLocal();
  const { checkNetwork, isOnline, updateOnlineStatus } = useInternet();

  const handleStreakUpdate = (newStreakValue: number) => {
    setStreakValue(newStreakValue);
  };

  const calculatePathCompletion = (matchedPath: PathData) => {
    const today = dayjs();
    const startDate = dayjs(matchedPath.startDate, 'D-MMMM-YYYY');
    const days = today.diff(startDate, 'day');
    const averageMatchedAngs = (matchedPath.saveData.angNumber || 0) / (days ? days : 1);

    const remainingAngs = 1430 - matchedPath.saveData.angNumber;
    const remainingDays = remainingAngs / (averageMatchedAngs ? averageMatchedAngs : 1);
    const completionDate = today.add(remainingDays, 'day');
    setFinishDate(dayjs(completionDate).format('D-MMMM-YYYY'));
    setDaysAgo(today.format('D-MMMM-YYYY') === startDate.format('D-MMMM-YYYY') ? 0 : days);
    setAverageAngs(averageMatchedAngs === Infinity ? 0 : parseFloat(averageMatchedAngs.toFixed(2)));
  };
  const fetchPath = useCallback(async () => {
    const { pathDataArray } = await fetchFromLocal();
    const matchedPath = pathDataArray.find((path: PathData) => path.pathId === pathId);
    setPathData(matchedPath);
    return { matchedPath };
  }, [fetchFromLocal, pathId]);

  const updateTheData = useCallback(async () => {
    const { matchedPath } = await fetchPath();
    if (matchedPath) {
      const show = matchedPath?.saveData.angNumber < 10 ? false : true;
      setShowData(show);
      setPathAng(matchedPath?.saveData.angNumber || 0);
      const matchedPathPercentage = parseFloat(
        (((matchedPath?.saveData.angNumber || 0) / 1430) * 100).toFixed(2)
      );
      setPathPercentage(matchedPathPercentage);
      calculatePathCompletion(matchedPath);
    }
  }, [fetchPath]);

  useFocusEffect(
    useCallback(() => {
      updateTheData();
    }, [updateTheData])
  );

  const handleContinue = async () => {
    await checkNetwork();
    if (!isOnline) {
      return;
    }
    navigation.push('Path', { pathId: pathId });
  };
  useEffect(() => {
    updateOnlineStatus();
  }, [updateOnlineStatus]);

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
              onPress={() => navigation.push('Home')}
            >
              <NavContent navIcon={<GoBackIcon />} />
              <NavContent text={Constants.SEE_ALL_PATH} />
            </Pressable>
            <View style={ContinueScreenStyles.tabsContainer}>
              <Pressable
                style={tabs === 'progress' ? ContinueScreenStyles.tabActive : null}
                onPress={() => setTabs('progress')}
                onLongPress={() => setTabs('progress')}
              >
                <Text style={ContinueScreenStyles.tabText}>Progress</Text>
              </Pressable>
              <Pressable
                style={tabs === 'streak' ? ContinueScreenStyles.tabActive : null}
                onPress={() => setTabs('streak')}
                onLongPress={() => setTabs('streak')}
              >
                <Text style={ContinueScreenStyles.tabText}>Streak</Text>
              </Pressable>
            </View>
            {tabs === 'progress' && (
              <>
                <Pressable
                  style={ContinueScreenStyles.sehajHeadingContainer}
                  onPress={() => setShowPathRename(true)}
                  onLongPress={() => setShowPathRename(true)}
                >
                  <SecondaryHeading
                    text={pathName || pathData?.pathName}
                    textStyles={ContinueScreenStyles.sehajHeading}
                  />
                </Pressable>
                <ImportantText
                  importantText={Constants.WAHEGURU_JI_KA_KHALSA_WAHEGURU_JI_KI_FATEH}
                  importantTextStyles={ContinueScreenStyles.waheguruHeading}
                />
              </>
            )}

            {showData ? (
              <>
                {tabs === 'progress' && (
                  <>
                    <SimpleText
                      simpleText={[
                        Constants.YOU_ARE_ON_ANG_NUMBER,
                        <ImportantText
                          importantText={`${pathAng}`}
                          importantTextStyles={ContinueScreenStyles.impTextContainer}
                        />,
                        Constants.HAVE_COMPLETED,
                        <ImportantText
                          importantText={`${pathPercentage}%`}
                          importantTextStyles={ContinueScreenStyles.impTextContainer}
                        />,
                        Constants.SRI_SEHAJ_PATH,
                      ]}
                      simpleTextStyle={ContinueScreenStyles.textStyle}
                    />
                    <SimpleText
                      simpleText={[
                        Constants.STARTED_PATH,
                        <ImportantText importantText={`${daysAgo} days `} />,
                        Constants.AVERAGE_ABOUT,
                        <ImportantText importantText={`${averageAngs} angs a day. `} />,
                        Constants.COMPLETION_SEHAJ_PATH,
                        <ImportantText importantText={`${finishDate} 🎯 .`} />,
                      ]}
                    />
                  </>
                )}
                {tabs === 'streak' && (
                  <>
                    <View style={ContinueScreenStyles.streakContainer}>
                      <View style={ContinueScreenStyles.streakValueContainer}>
                        <SecondaryHeading
                          text={streakValue}
                          textStyles={ContinueScreenStyles.streakText}
                        />
                        <Text style={ContinueScreenStyles.lightningIcon}>⚡</Text>
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
              onPress={() => handleContinue()}
              buttonText={'Continue'}
              buttonIcon={<ContinueIcon />}
              buttonStyle={ContinueScreenStyles.continueButton}
            />
          </View>
        </ScrollView>
      </ImageBackground>
      {showPathRename && (
        <PathRename pathId={pathId} setPathRename={setShowPathRename} setPathName={setPathName} />
      )}
    </SafeAreaView>
  );
};
