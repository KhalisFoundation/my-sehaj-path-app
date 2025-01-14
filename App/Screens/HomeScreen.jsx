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
import { LinearGradient } from "expo-linear-gradient";
import ProgressCard from "../Components/ProgressCard";
import CompletedPathCard from "../Components/CompletePathCard";
import AsyncStorage from "@react-native-async-storage/async-storage";
const HomeScreen = () => {
  const { width: screenWidth } = useWindowDimensions();
  const [onGoingPath, setOnGogingPath] = useState([]);
  const [completedPath, setCompletedPath] = useState([]);
  useEffect(() => {
    const fetchPath = async () => {
      try {
        // const complete = [{ number: 1, date: "5 Jan 2024" }];
        // await AsyncStorage.setItem("CompletedPath", JSON.stringify(complete));
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
  useEffect(() => {});

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
        source={require("../assets/HomeScreenBackground.png")}
        style={styles.backgroundImage}
      >
        <View
          style={{
            paddingTop: screenWidth > 768 ? 28 : 50,
          }}
        >
          <Text style={styles.startSheajpathHeading}>
            It's a Fine day to start a
          </Text>
          <Text style={styles.startSheajpathHeading}>new Sehaj Path!</Text>

          <View style={styles.startButtonContainer}>
            <TouchableOpacity
              style={{
                width: screenWidth > 768 ? 140 : 112,
                height: screenWidth > 768 ? 55 : 48,
              }}
              onPress={handleNewPath}
            >
              <LinearGradient
                colors={["#11336A", "#0D2346"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  borderRadius: screenWidth > 768 ? 35 : 25,
                }}
              >
                <View style={styles.startButtonContent}>
                  <Image
                    source={require("../assets/PathStartButton.png")}
                    style={{
                      ...styles.plusWaves,
                      marginRight: 12,
                      height: screenWidth > 768 ? 30 : 24,
                      width: screenWidth > 768 ? 30 : 24,
                    }}
                  />
                  <Text
                    style={{
                      ...styles.startButtonText,
                      fontSize: screenWidth > 768 ? 22 : 16,
                    }}
                  >
                    START
                  </Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          {onGoingPath.length != 0 ? (
            <>
              <View style={styles.sectionTitleContainer}>
                <Text
                  style={{
                    ...styles.sectionTitle,
                    fontSize: screenWidth > 500 ? 21 : 14,
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
                  ? onGoingPath.map((path, index) => (
                      <View key={index} style={styles.cardWrapper}>
                        <ProgressCard
                          sheajPathNumber={path.number}
                          angNumber={path.ang}
                          progress={path.progress}
                        />
                      </View>
                    ))
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
                    fontSize: screenWidth > 500 ? 21 : 14,
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
                  <View key={index} style={styles.completedCardWrapper}>
                    <CompletedPathCard
                      sehajNumber={path.number}
                      completionDate={path.date}
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
  parentContainer: {
    flex: 1,
    padding: 50,
    alignItems: "center",
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignContent: "center",
  },

  startSheajpathHeading: {
    fontFamily: "Recoleta-Regular",
    fontSize: 28,
    color: "#11336A",
    textAlign: "center",
    lineHeight: 38,
  },
  startButtonContainer: {
    alignSelf: "center",
    marginTop: 28,
  },
  startButtonContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  startButtonText: {
    fontFamily: "BalooPaaji2Regular",
    color: "white",
    fontSize: 16,
  },
  sectionTitleContainer: {
    marginBottom: 15,
    marginTop: 41,
  },
  sectionTitle: {
    fontFamily: "BrandonGrotesque-Regular",
    lineHeight: 20,
    textAlign: "center",
    color: "#11336A",
  },
});

export default HomeScreen;
