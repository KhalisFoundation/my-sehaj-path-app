import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  useWindowDimensions,
} from "react-native";

import ProgressCard from "../components/PathProgressCard";
import CompletedPathCard from "../components/CompletedPathCard";
import LinearGradient from "react-native-linear-gradient";
import font from "../utils/font";
import AsyncStorage from "@react-native-async-storage/async-storage";
interface onGoingPath {
  number: number;
  ang: number;
  progress: number;
}
interface completedPath {
  number: number;
  date: string;
}
const HomeScreen = () => {
  const { width } = useWindowDimensions();
  const [onGoingPath, setOnGogingPath] = useState<onGoingPath[]>([]);
  const [completedPath, setCompletedPath] = useState<completedPath[]>([]);
  useEffect(() => {
    const fetchPath = async () => {
      try {
        const storedInProgressPath = await AsyncStorage.getItem(
          "PathInProgress"
        );
        const paths = storedInProgressPath
          ? JSON.parse(storedInProgressPath)
          : [];
        const storedCompletedPath = await AsyncStorage.getItem("CompletedPath");
        const completedPath = storedCompletedPath
          ? JSON.parse(storedCompletedPath)
          : [];
        setCompletedPath(completedPath);
        setOnGogingPath(paths);
      } catch {
        setOnGogingPath([]);
      }
    };
    fetchPath();
  }, []);
  const handleNewPath = async () => {
    try {
      let storedPath = await AsyncStorage.getItem("PathInProgress");

      let pathInProgressArray = storedPath ? JSON.parse(storedPath) : [];
      let lastPath =
        pathInProgressArray.length <= 0
          ? 0
          : pathInProgressArray[pathInProgressArray.length - 1].number;
      let pathnumber = (await lastPath) + 1;
      await pathInProgressArray.push({
        number: pathnumber,
        ang: 1,
        progress: 0,
      });
      await AsyncStorage.setItem(
        "PathInProgress",
        JSON.stringify(pathInProgressArray)
      );
      setOnGogingPath(pathInProgressArray);
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <>
      <ImageBackground
        source={require("../images/homeScreenBackground.png")}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.container}>
          <View style={styles.headingContainer}>
            <Text style={styles.header}>It's a Fine day to start a</Text>
            <Text style={styles.header}> new Sehaj Path!</Text>
          </View>
          <View style={styles.startButtonContainer}>
            <LinearGradient
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              colors={["#11336A", "#0D2346"]}
              style={{
                ...styles.startButton,
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
                    ...styles.pathStartButtonIcon,
                    height: width > 768 ? 30 : 24,
                    width: width > 768 ? 30 : 24,
                  }}
                />
                <Text
                  style={{
                    ...styles.startButtonText,
                    fontSize: width > 768 ? 20 : 16,
                  }}
                >
                  START
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {onGoingPath.length != 0 ? (
            <>
              <View style={styles.sectionTitleContainer}>
                <Text
                  style={{
                    ...styles.sectionTitle,
                    fontSize: width > 500 ? 21 : 14,
                  }}
                >
                  Sehaj Path in Progress:
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {onGoingPath.length != 0
                  ? onGoingPath.map((path, index) => {
                      return (
                        <View key={index}>
                          <ProgressCard
                            sheajPathNumber={path.number}
                            angNumber={path.ang}
                            progress={path.progress}
                          />
                        </View>
                      );
                    })
                  : undefined}
              </ScrollView>
            </>
          ) : undefined}
          {completedPath.length != 0 ? (
            <>
              <View style={styles.sectionTitleContainer}>
                <Text
                  style={{
                    ...styles.sectionTitle,
                    fontSize: width > 500 ? 21 : 14,
                  }}
                >
                  Sehaj Paths Completed:
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {completedPath.map((path, index) => (
                  <View key={index}>
                    <CompletedPathCard
                      sheajPathNumber={path?.number}
                      pathCompletionDate={path?.date}
                    />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : undefined}
        </View>
      </ImageBackground>
    </>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    resizeMode: "cover",
    transform: [{ scale: 1.2 }, { translateX: 0 }],
    width: "300%",
    height: "100%",
    overflow: "hidden",
  },
  container: {
    backgroundColor: "rgba(245, 245, 245,0.89)",
    height: "100%",
    padding: 15,
    paddingTop: 59,
  },
  headingContainer: { marginBottom: 20 },
  header: {
    fontSize: 27,
    color: "#11336A",
    textAlign: "center",
    fontFamily: font.Recoleta_Regular,
    lineHeight: 38,
  },
  startButtonContainer: {
    alignItems: "center",
    marginBottom: 41,
  },
  startButton: {
    padding: 7,
    backgroundColor: "transparent",
    justifyContent: "center",
    borderRadius: 100,
  },
  startButtonText: {
    color: "white",
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: font.Baloo_Paaji_2_Regular,
  },
  pathStartButtonIcon: {
    width: 24,
    height: 24,
    marginRight: 11,
  },
  sectionTitleContainer: {
    alignItems: "center",
    marginBottom: 15,
    marginTop: 20,
  },
  sectionTitle: {
    fontFamily: font.Brandon_Grotesque_Regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: "#11336A",
  },
  horizontalScroll: {
    flexDirection: "row",
    marginBottom: 40,
  },
  completedText: {
    fontSize: 16,
    color: "#11336A",
  },
  completedAngText: {
    fontSize: 14,
    color: "#666666",
  },
  //   screenBorder: {
  //     width: 393,
  //     height: 852,
  //     position: "absolute",
  //     top: -444,
  //     left: 1564,
  //     borderRadius: 15,
  //     borderTopWidth: 4,
  //     borderTopColor: "rgba(253, 198, 6, 0.3)",
  //     borderRightWidth: 0,
  //     borderBottomWidth: 0,
  //     borderLeftWidth: 0,
  //     opacity: 1,
  //   },
});

export default HomeScreen;
