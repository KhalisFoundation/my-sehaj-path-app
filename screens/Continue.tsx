import { View, ScrollView, ImageBackground, Text } from "react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ContinueScreenStyles } from "@styles";
import { Constants } from "@constants";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { useLocal, PathData } from "../hooks/useLocal";
import { GoBackIcon, ContinueIcon } from "@icons";
import {
  NavContent,
  SecondaryButton,
  SimpleText,
  SecondaryHeading,
  ImportantText,
  Streak,
} from "@components";
import { useInternet } from "../hooks/useInternet";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SafeAreaStyle } from "@styles/SafeAreaStyle";
interface Date {
  date: string;
  angs: number;
}
interface PathDate {
  pathid: number;
  dates: Date[];
}

type ContinueProps = NativeStackScreenProps<RootStackParamList, "Continue">;

export default function Continue({ route, navigation }: ContinueProps) {
  const [pathData, setPathData] = useState<PathData>();
  const [pathDate, setPathDate] = useState<PathDate>();
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathPercentage, setPathPercentage] = useState<number>(0);
  const [daysAgo, setDaysAgo] = useState<number>(0);
  const [averageAngs, setAverageAngs] = useState<number>(0);
  const [finishDate, setFinishDate] = useState<string>();
  const [streakData, setStreakData] = useState<Date[]>();
  const [showData, setShowData] = useState<boolean>();
  const { pathId } = route.params;
  dayjs.extend(customParseFormat);
  const { fetchFromLocal } = useLocal();
  const { checkNetwork, isOnline, updateOnlineStatus } = useInternet();

  const calculatePathCompletion = (matchedPath: PathData) => {
    const today = dayjs();
    const startDate = dayjs(matchedPath.startDate, "D-MMMM-YYYY");
    const days = today.diff(startDate, "day");
    const averageAngs =
      (matchedPath.saveData.angNumber || 0) / (days ? days : 1);
    const remainingAngs = 1430 - matchedPath.saveData.angNumber;
    const remainingDays = remainingAngs / (averageAngs ? averageAngs : 1);
    const completionDate = today.add(remainingDays, "day");
    setFinishDate(dayjs(completionDate).format("D-MMMM-YYYY"));
    setDaysAgo(
      today.format("D-MMMM-YYYY") == startDate.format("D-MMMM-YYYY") ? 0 : days
    );
    setAverageAngs(averageAngs == Infinity ? 0 : averageAngs);
  };

  const updateTheData = async () => {
    const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
    const matchedPath = pathDataArray.find(
      (path: PathData) => path.pathId == pathId
    );
    const matchedDates = pathDateDataArray.find(
      (path: PathDate) => path.pathid === pathId
    );
    if (matchedPath) {
      const show = matchedPath?.saveData.angNumber < 10 ? false : true;
      setShowData(show);
      setPathDate(matchedDates);
      setPathData(matchedPath);
      setPathAng(matchedPath?.saveData.angNumber || 0);
      const pathPercentage = parseFloat(
        (((matchedPath?.saveData.angNumber || 0) / 1430) * 100).toFixed(2)
      );
      setPathPercentage(pathPercentage);
      calculatePathCompletion(matchedPath);
    }
  };

  const makeStreakIndicator = (date: string) => {
    const today = dayjs();
    const startDate = dayjs(date, "D-MMMM-YYYY");
    let currentDate = startDate;
    const dates: any = [];
    while (currentDate.isBefore(today) || currentDate.isSame(today)) {
      dates.push({ date: currentDate.format("D-MMMM-YYYY"), angs: 0 });
      currentDate = currentDate.add(1, "day");
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
    }, [])
  );
  useEffect(() => {
    pathData?.startDate ? makeStreakIndicator(pathData.startDate) : undefined;
  }, [pathData]);
  const handleContinue = async () => {
    await checkNetwork();
    if (!isOnline) {
      return;
    }
    navigation.push("Path", { pathId: pathId });
  };
  useEffect(() => {
    updateOnlineStatus();
  }, []);
  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <ImageBackground
        source={require("../assets/Images/ContinueScreenBg.png")}
        style={ContinueScreenStyles.backgroundImage}
      >
        <ScrollView
          contentContainerStyle={ContinueScreenStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={ContinueScreenStyles.container}>
            <View style={ContinueScreenStyles.navContainer}>
              <NavContent
                navIcon={<GoBackIcon />}
                onPress={() => {
                  navigation.push("Home");
                }}
              />
              <NavContent text={Constants.SEE_ALL_PATH} />
            </View>
            <View style={ContinueScreenStyles.sehajHeadingContainer}>
              <SecondaryHeading
                text={Constants.PATH}
                textStyles={ContinueScreenStyles.sehajHeading}
              />
              <SecondaryHeading
                text={" #"}
                textStyles={ContinueScreenStyles.sehajHeading}
              />
              <SecondaryHeading
                text={`${pathId}`}
                textStyles={ContinueScreenStyles.sehajHeading}
              />
            </View>
            <ImportantText
              importantText={
                Constants.WAHEGURU_JI_KA_KHALSA_WAHEGURU_JI_KI_FATEH
              }
              importantTextStyles={ContinueScreenStyles.waheguruHeading}
            />

            {showData ? (
              <>
                <View>
                  <SimpleText
                    simpleText={[
                      Constants.YOU_ARE_ON_ANG_NUMBER,
                      <View style={ContinueScreenStyles.impTextContainer}>
                        <ImportantText
                          importantText={`${pathAng}`}
                          importantTextStyles={ContinueScreenStyles.textStyle}
                        />
                      </View>,
                      Constants.HAVE_COMPLETED,
                      <View style={ContinueScreenStyles.impTextContainer}>
                        <ImportantText
                          importantText={`${pathPercentage}%`}
                          importantTextStyles={ContinueScreenStyles.textStyle}
                        />
                      </View>,
                      Constants.SRI_SEHAJ_PATH,
                    ]}
                    simpleTextStyle={ContinueScreenStyles.textStyle}
                  />
                </View>
                <View>
                  <SimpleText
                    simpleText={[
                      Constants.STARTED_PATH,
                      <ImportantText importantText={`${daysAgo} days `} />,
                      Constants.AVERAGE_ABOUT,
                      <ImportantText
                        importantText={`${averageAngs} angs a day. `}
                      />,
                      Constants.COMPLETION_SEHAJ_PATH,
                      <ImportantText importantText={`${finishDate} 🎯 .`} />,
                    ]}
                  />
                </View>
                <View>
                  <SimpleText
                    simpleText={[`${Constants.HERE_YOURS_STREAK_CHART}`]}
                  />
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
              buttonText={"Continue"}
              buttonIcon={<ContinueIcon />}
              buttonStyle={{ width: 110 }}
            />
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}
