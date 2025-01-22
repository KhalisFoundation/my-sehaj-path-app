import React from "react";
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

const HomeScreen = () => {
  const { width } = useWindowDimensions();

  const inProgressPaths = [
    { number: 14, ang: 745, progress: 65 },
    { number: 15, ang: 1145, progress: 25 },
    { number: 16, ang: 500, progress: 40 },
    { number: 17, ang: 800, progress: 80 },
  ];

  const completedPaths = [
    { number: 11, date: "4th Aug 2024" },
    { number: 10, date: "13th Jan 2024" },
    { number: 9, date: "11th Oct 2023" },
  ];

  return (
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
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Sehaj Path in Progress:</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
        >
          {inProgressPaths.map((path, index) => (
            <View key={index}>
              <ProgressCard
                sheajPathNumber={path.number}
                angNumber={path.ang}
                progress={path.progress}
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>Sehaj Paths Completed:</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
        >
          {completedPaths.map((path, index) => (
            <View key={index}>
              <CompletedPathCard
                sheajPathNumber={path.number}
                pathCompletionDate={path.date}
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </ImageBackground>
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
