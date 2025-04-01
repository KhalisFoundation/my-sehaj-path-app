import { View, ImageBackground, ScrollView } from "react-native";
import React, { useEffect, useState } from "react";
import Headline from "../components/Headline";
import PrimaryButton from "../components/PrimaryButton";
import StartIcon from "../icons/Start.icon";
import Slider from "../components/Slider";
import { PrimaryCard } from "../components/PrimaryCard";
import { SecondaryCard } from "../components/SecondaryCard";
import Label from "../components/Label";
import { HomeScreenStyles } from "../styles/HomeScreenStyles";
import { Constants, MonthConstant } from "../constants/index";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PathData {
  pathId: number;
  angNumber: number;
  progress: number;
  startDate: string;
  completionDate: string;
}
interface DateData {
  pathid: number;
  dates: PathDate[];
}
interface PathDate {
  date: string;
  angs: number;
}

export default function HomeScreen() {
  const [pathInProgress, setPathInProgress] = useState<PathData[]>([]);
  const [pathCompleted, setPathCompleted] = useState<PathData[]>([]);
  useEffect(() => {
    const fetch = async () => {
      const { pathDataArray, pathDateDataArray } = await fetchPathLocal();
      setPathCompleted(
        pathDataArray.filter((path: PathData) => path.angNumber == 1430)
      );
      setPathInProgress(
        pathDataArray.filter((path: PathData) => path.angNumber != 1430)
      );
    };
    fetch();
  }, []);
  const fetchPathLocal = async () => {
    const pathData = await AsyncStorage.getItem("pathDetails");
    const pathDataArray: PathData[] = pathData ? JSON.parse(pathData) : [];
    const pathDateData = await AsyncStorage.getItem("pathDateDetails");
    const pathDateDataArray: DateData[] = pathDateData
      ? JSON.parse(pathDateData)
      : [];
    return { pathDataArray, pathDateDataArray };
  };
  const handleStart = async () => {
    const { pathDataArray, pathDateDataArray } = await fetchPathLocal();
    let pathid = pathDataArray.length > 0 ? pathDataArray.length : 0;
    let newPathid = pathid + 1;
    const date = new Date();
    const startNewPathDate = `${date.getDate()}-${
      MonthConstant[date.getMonth()]
    }-${date.getFullYear()}`;
    pathDataArray.push({
      pathId: newPathid,
      progress: 1,
      angNumber: 0,
      startDate: startNewPathDate,
      completionDate: "",
    });
    pathDateDataArray.push({
      pathid: newPathid,
      dates: [],
    });
    setPathInProgress(pathDataArray.filter((path) => path.angNumber != 1430));
    setPathCompleted(
      pathDataArray.filter((path: PathData) => path.angNumber == 1430)
    );
    AsyncStorage.setItem("pathDetails", JSON.stringify(pathDataArray));
    AsyncStorage.setItem("pathDateDetails", JSON.stringify(pathDateDataArray));
  };

  return (
    <>
      <ImageBackground
        source={require("../assets/Images/HomeScreenBg.png")}
        resizeMode="cover"
        style={HomeScreenStyles.backgroundImage}
      >
        <ScrollView contentContainerStyle={HomeScreenStyles.scrollContainer}>
          <View style={HomeScreenStyles.container}>
            <Headline headline={Constants.ITS_FINE_DAY_TO_START_A} />
            <Headline headline={Constants.NEW_SEHAJ_PATH} />

            <PrimaryButton
              buttonTitle={Constants.START}
              Icon={<StartIcon />}
              onPress={handleStart}
            />
            {pathInProgress?.length > 0 ? (
              <View style={HomeScreenStyles.pathInProgressContianer}>
                <Label label={`${Constants.SEHAJ_PATH_IN_PROGRESS} :`} />
                <Slider
                  arrayOfCards={pathInProgress?.map((path: PathData) => (
                    <PrimaryCard
                      sehajPathNumber={path.pathId}
                      angNumber={path.angNumber}
                      progress={path.progress}
                      onPress={() => {}}
                    />
                  ))}
                  widthOfCard={199}
                  dotsIndicator={true}
                />
              </View>
            ) : undefined}
            {pathCompleted?.length > 0 ? (
              <View style={HomeScreenStyles.pathCompletedContainer}>
                <Label label={`${Constants.SEHAJ_PATH_COMPLETED} :`} />
                <Slider
                  arrayOfCards={pathCompleted.map((path: PathData) => (
                    <SecondaryCard
                      sehajPathNumber={path.pathId}
                      pathCompletionDate={path.completionDate}
                    />
                  ))}
                  widthOfCard={0}
                  dotsIndicator={false}
                />
              </View>
            ) : undefined}
          </View>
        </ScrollView>
      </ImageBackground>
    </>
  );
}
