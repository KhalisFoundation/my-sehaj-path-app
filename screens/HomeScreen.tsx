import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  useWindowDimensions,
} from "react-native";
import ProgressCard from "../components/PathProgressCard";
import CompletedPathCard from "../components/CompletedPathCard";
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HomeScreenStyles } from "../styles/HomeScreen";
import { Constants } from "../constants/Constants";

interface Path {
  number: number;
  ang: number;
  progress: number;
  startDate: string;
  endDate: string;
}

const HomeScreen = () => {
  const { width } = useWindowDimensions();
  const [onGoingPath, setOnGogingPath] = useState<Path[]>([]);
  const [completedPath, setCompletedPath] = useState<Path[]>([]);

  useEffect(() => {
    const fetchPath = async () => {
      try {
        const storedPath = await AsyncStorage.getItem("storedPath");
        const paths = storedPath ? JSON.parse(storedPath) : [];

        setCompletedPath(paths?.filter((path: Path) => path.ang == 1430));
        setOnGogingPath(paths?.filter((path: Path) => path.ang != 1430));
      } catch {
        setOnGogingPath([]);
      }
    };
    fetchPath();
  }, []);

  const handleNewPath = async () => {
    try {
      const storedPath = await AsyncStorage.getItem("storedPath");
      let storedPathArray = storedPath ? JSON.parse(storedPath) : [];
      let lastPath =
        storedPathArray.length <= 0
          ? 0
          : storedPathArray[storedPathArray.length - 1].number;
      let pathnumber = lastPath + 1;

      const todayDate: string = new Date()
        .toUTCString()
        .split(" ")
        .slice(1, 4)
        .join("");

      storedPathArray.push({
        number: pathnumber,
        ang: 1,
        progress: 0,
        startDate: todayDate,
        endDate: "",
      });
      setOnGogingPath(storedPathArray.filter((path: Path) => path.ang != 1430));
      await AsyncStorage.setItem("storedPath", JSON.stringify(storedPathArray));
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <>
      <ImageBackground
        source={require("../images/homeScreenBackground.png")}
        imageStyle={HomeScreenStyles.backgroundImage}
      >
        <View style={HomeScreenStyles.container}>
          <View style={HomeScreenStyles.headingContainer}>
            <Text style={HomeScreenStyles.header}>
              {Constants.HOME_TAGLINE_1}
            </Text>
            <Text style={HomeScreenStyles.header}>
              {" "}
              {Constants.HOME_TAGLINE_2}
            </Text>
          </View>
          <View style={HomeScreenStyles.startButtonContainer}>
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              colors={["#11336A", "#0D2346"]}
              style={{
                ...HomeScreenStyles.startButton,
                width: width > 768 ? 140 : 112,
                height: width > 768 ? 55 : 48,
              }}
            >
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onPress={handleNewPath}
              >
                <Image
                  source={require("../images/pathStartButtonIcon.png")}
                  style={{
                    ...HomeScreenStyles.pathStartButtonIcon,
                    height: width > 768 ? 30 : 24,
                    width: width > 768 ? 30 : 24,
                  }}
                />
                <Text
                  style={{
                    ...HomeScreenStyles.startButtonText,
                    fontSize: width > 768 ? 20 : 16,
                  }}
                >
                  {Constants.START}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {onGoingPath.length > 0 ? (
            <>
              <View style={HomeScreenStyles.sectionTitleContainer}>
                <Text
                  style={{
                    ...HomeScreenStyles.sectionTitle,
                    fontSize: width > 500 ? 21 : 14,
                  }}
                >
                  {Constants.SEHAJ_PATH_IN_PROGRESS}:
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={HomeScreenStyles.horizontalScroll}
              >
                {onGoingPath.map((path, index) => {
                  return (
                    <ProgressCard
                      key={index}
                      sehajPathNumber={path.number}
                      angNumber={path.ang}
                      progress={path.progress}
                    />
                  );
                })}
              </ScrollView>
            </>
          ) : undefined}
          {completedPath.length > 0 ? (
            <>
              <View style={HomeScreenStyles.sectionTitleContainer}>
                <Text
                  style={{
                    ...HomeScreenStyles.sectionTitle,
                    fontSize: width > 500 ? 21 : 14,
                  }}
                >
                  {Constants.SEHAJ_PATH_COMPLETED}:
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={HomeScreenStyles.horizontalScroll}
              >
                {completedPath.map((path, index) => (
                  <View key={index}>
                    <CompletedPathCard
                      sehajPathNumber={path?.number}
                      pathCompletionDate={path?.endDate}
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : null}
        </View>
      </ImageBackground>
    </>
  );
};

export default HomeScreen;
