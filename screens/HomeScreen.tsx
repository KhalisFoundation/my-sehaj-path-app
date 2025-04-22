import { View, ImageBackground, ScrollView } from "react-native";
import React, { useEffect, useState } from "react";
import { HomeScreenStyles } from "@styles";
import { Constants } from "@constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { useLocal } from "../hooks/useLocal";
import {
  Headline,
  Slider,
  PrimaryButton,
  PrimaryCard,
  SecondaryCard,
  Label,
} from "../components";
import { StartIcon } from "../icons";

interface PathData {
  pathId: number;
  saveData: { angNumber: number; verseId: number };
  progress: number;
  startDate: string;
  completionDate: string;
}
type HomeProps = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: HomeProps) {
  const [pathInProgress, setPathInProgress] = useState<PathData[]>([]);
  const [pathCompleted, setPathCompleted] = useState<PathData[]>([]);
  const { fetchFromLocal, handleNewPath } = useLocal();
  useEffect(() => {
    const fetch = async () => {
      const { pathDataArray } = await fetchFromLocal();

      setPathCompleted(
        pathDataArray.filter(
          (path: PathData) =>
            path.saveData.angNumber == 1430 && path.saveData.verseId == 60403
        )
      );
      setPathInProgress(
        pathDataArray.filter(
          (path: PathData) =>
            path.saveData.angNumber <= 1430 && path.saveData.verseId < 60403
        )
      );
    };
    fetch();
  }, []);

  const handleStart = async () => {
    const { pathDataArray, pathDateDataArray, newPathid } =
      await handleNewPath();
    setPathInProgress(
      pathDataArray.filter((path: PathData) => path.saveData.angNumber != 1430)
    );
    setPathCompleted(
      pathDataArray.filter(
        (path: PathData) =>
          path.saveData.angNumber == 1430 && path.saveData.verseId == 60403
      )
    );
    AsyncStorage.setItem("pathDetails", JSON.stringify(pathDataArray));
    AsyncStorage.setItem("pathDateDetails", JSON.stringify(pathDateDataArray));
    navigation.push("Continue", { pathId: newPathid });
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
                      angNumber={path.saveData.angNumber}
                      progress={path.progress}
                      onPress={() => {
                        navigation.push("Continue", { pathId: path.pathId });
                      }}
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
