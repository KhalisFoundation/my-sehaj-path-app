import { View, ScrollView, ImageBackground, Text } from 'react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ContinueScreenStyles } from '@styles';
import { Constants } from '@constants';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { useLocal, PathData } from '../hooks/useLocal';
import { GoBackIcon, ContinueIcon } from '@icons';
import {
  NavContent,
  SecondaryButton,
  SimpleText,
  SecondaryHeading,
  ImportantText,
  Streak,
  PathRename,
} from '@components';
import { useInternet } from '../hooks/useInternet';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaStyle } from '@styles/SafeAreaStyle';
import { Pressable } from 'react-native';

interface Date {
  date: string;
  angs: number;
}
interface PathDate {
  pathid: number;
  dates: Date[];
}

type ContinueProps = NativeStackScreenProps<RootStackParamList, 'Continue'>;

export const Continue = ({ route, navigation }: ContinueProps) => {
  const [pathData, setPathData] = useState<PathData>();
  const [pathDate, setPathDate] = useState<PathDate>();
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathPercentage, setPathPercentage] = useState<number>(0);
  const [daysAgo, setDaysAgo] = useState<number>(0);
  const [averageAngs, setAverageAngs] = useState<number>(0);
  const [finishDate, setFinishDate] = useState<string>();
  const [streakData, setStreakData] = useState<Date[]>();
  const [showData, setShowData] = useState<boolean>();
  const [showPathRename, setShowPathRename] = useState<boolean>(false);
  const [pathName, setPathName] = useState<string>('');
  const { pathId } = route.params;
  dayjs.extend(customParseFormat);
  const { fetchFromLocal } = useLocal();
  const { checkNetwork, isOnline, updateOnlineStatus } = useInternet();

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
  const fetchPath = async () => {
    const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
    const matchedPath = pathDataArray.find((path: PathData) => path.pathId === pathId);
    const matchedDates = pathDateDataArray.find((path: PathDate) => path.pathid === pathId);
    setPathDate(matchedDates);
    setPathData(matchedPath);
    return { matchedPath, matchedDates };
  };
  const updateTheData = async () => {
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
  };

  const makeStreakIndicator = (startDate: string) => {
    const today = dayjs();
    const start = dayjs(startDate, 'D-MMMM-YYYY');
    let currentDate = start;
    const dates: any = [];
    while (currentDate.isBefore(today) || currentDate.isSame(today)) {
      dates.push({ date: currentDate.format('D-MMMM-YYYY'), angs: 0 });
      currentDate = currentDate.add(1, 'day');
    }
    const mergeDates = new Map();
    for (let date of [...dates, ...(pathDate?.dates || [])]) {
      mergeDates.set(date.date, date);
    }
    setStreakData(Array.from(mergeDates.values()));
  };
  useFocusEffect(
    useCallback(() => {
      updateTheData();
    }, [pathId])
  );
  useEffect(() => {
    pathData?.startDate ? makeStreakIndicator(pathData.startDate) : undefined;
  }, [pathData]);
  const handleContinue = async () => {
    await checkNetwork();
    if (!isOnline) {
      return;
    }
    navigation.push('Path', { pathId: pathId });
  };
  useEffect(() => {
    updateOnlineStatus();
  }, []);

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

            {showData ? (
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

                <View>
                  <SimpleText simpleText={[`${Constants.HERE_YOURS_STREAK_CHART}`]} />
                  <ScrollView
                    contentContainerStyle={ContinueScreenStyles.streakScroll}
                    style={ContinueScreenStyles.streakScrollContainer}
                    showsVerticalScrollIndicator={true}
                  >
                    {streakData?.map((data, index) => {
                      return <Streak value={data.angs} key={index} />;
                    })}
                  </ScrollView>
                </View>
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
