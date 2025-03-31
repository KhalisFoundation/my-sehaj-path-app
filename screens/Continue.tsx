import { View, ScrollView, ImageBackground, FlatList } from "react-native";
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
    const startDate = dayjs(matchedPath.startDate, "DD-MMMM-YYYY");
    const days = Math.max(today.diff(startDate, "day"), 1);
    const averageAngs = (matchedPath.angNumber || 0) / days;
    const remainingAngs = 1480 - matchedPath.angNumber;
    const remainingDays = remainingAngs / averageAngs;
    const completionDate = today.add(remainingDays, "day");
    setFinishDate(dayjs(completionDate).format("DD-MMMM-YYYY"));
    setDaysAgo(
      today.format("DD-MMMM-YYYY") == startDate.format("DD-MMMM-YYYY")
        ? 0
        : days
    );
    setAverageAngs(averageAngs == Infinity ? 0 : averageAngs);
  };

  const updateTheData = async () => {
    const { allPath, allDates } = await fetchPath();
    const matchedPath = allPath.find(
      (path: PathData) => path.angNumber == pathId
    );
    const matchedDates = allDates.find(
      (path: PathDate) => path.pathid === pathId
    );
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
    const startDate = dayjs(date, "DD-MMMM-YYYY");
    let currentDate = startDate;
    const dates: any = [];
    while (currentDate.isBefore(today) || currentDate.isSame(today)) {
      dates.push({ date: currentDate.format("DD-MMMM-YYYY"), angs: 0 });
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
    setStreakData([
      { angs: 5, date: "31-Match-2025" },
      {
        angs: 5,
        date: "31-Match-2025",
      },
    ]);
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
                  <ImportantText importantText={`${finishDate} .`} />,
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
