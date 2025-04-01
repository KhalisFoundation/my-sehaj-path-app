import { View, ScrollView, ImageBackground, Text } from "react-native";
import React, { useEffect, useState } from "react";
import { ContinueScreenStyles } from "../styles/ContinueScreenStyles";
import NavContent from "../components/NavContent";
import GoBackIcon from "../icons/GoBack.icon";
import { Constants } from "../constants";
import SecondaryHeading from "../components/SecondaryHeading";
import ImportantText from "../components/ImportantText";
import SimpleText from "../components/SimpleText";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Streak } from "../components/Streak";
import SecondaryButton from "../components/SecondaryButton";
import ContinueIcon from "../icons/Continue.icon";

interface Props {
  pathId: number;
}
interface PathData {
  pathId: number;
  angNumber: number;
  progress: number;
  startDate: string;
  completionDate: string;
}
interface Date {
  date: string;
  angs: number;
}
interface PathDate {
  pathid: number;
  dates: Date[];
}

export default function Continue({ pathId }: Props) {
  const [pathData, setPathData] = useState<PathData>();
  const [pathDate, setPathDate] = useState<PathDate>();
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathPercentage, setPathPercentage] = useState<number>(0);
  const [daysAgo, setDaysAgo] = useState<number>(0);
  const [averageAngs, setAverageAngs] = useState<number>(0);
  const [finishDate, setFinishDate] = useState<string>();
  const [streakData, setStreakData] = useState<Date[]>();
  const [showData, setShowData] = useState<boolean>();

  dayjs.extend(customParseFormat);

  const fetchPath = async () => {
    const allPathData = await AsyncStorage.getItem("pathDetails");
    const allPthDates = await AsyncStorage.getItem("pathDateDetails");
    const allPath = allPathData ? JSON.parse(allPathData) : undefined;
    const allDates = allPthDates ? JSON.parse(allPthDates) : undefined;
    return { allPath, allDates };
  };

  const calculatePathCompletion = (matchedPath: PathData) => {
    const today = dayjs();
    const startDate = dayjs(matchedPath.startDate, "D-MMMM-YYYY");
    const days = today.diff(startDate, "day");
    const averageAngs = (matchedPath.angNumber || 0) / (days ? days : 1);
    const remainingAngs = 1430 - matchedPath.angNumber;
    const remainingDays = remainingAngs / (averageAngs ? averageAngs : 1);
    const completionDate = today.add(remainingDays, "day");
    setFinishDate(dayjs(completionDate).format("D-MMMM-YYYY"));
    setDaysAgo(
      today.format("D-MMMM-YYYY") == startDate.format("D-MMMM-YYYY") ? 0 : days
    );
    setAverageAngs(averageAngs == Infinity ? 0 : averageAngs);
  };

  const updateTheData = async () => {
    const { allPath, allDates } = await fetchPath();
    const matchedPath = allPath.find((path: PathData) => path.pathId == pathId);
    const matchedDates = allDates.find(
      (path: PathDate) => path.pathid === pathId
    );
    const show = matchedPath.angNumber < 10 ? false : true;
    setShowData(show);
    setPathDate(matchedDates);
    setPathData(matchedPath);
    setPathAng(matchedPath?.angNumber || 0);
    const pathPercentage = parseFloat(
      (((matchedPath?.angNumber || 0) / 1430) * 100).toFixed(2)
    );
    setPathPercentage(pathPercentage);
    calculatePathCompletion(matchedPath);
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
  useEffect(() => {
    updateTheData();
  }, []);
  useEffect(() => {
    pathData?.startDate ? makeStreakIndicator(pathData.startDate) : undefined;
  }, [pathData]);
  return (
    <>
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
              <NavContent navIcon={<GoBackIcon />} />
              <NavContent text={Constants.SEE_ALL_PATH} />
            </View>
            <View style={ContinueScreenStyles.sehajHeadingContainer}>
              <SecondaryHeading
                text={Constants.SEHAJ}
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
              onPress={() => {}}
              buttonText={"Continue"}
              buttonIcon={<ContinueIcon />}
              buttonStyle={{ width: 110 }}
            />
          </View>
        </ScrollView>
      </ImageBackground>
    </>
  );
}
