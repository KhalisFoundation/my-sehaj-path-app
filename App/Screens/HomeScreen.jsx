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
import { LinearGradient } from "expo-linear-gradient";
import ProgressCard from "../Components/ProgressCard";
import CompletedPathCard from "../Components/CompletePathCard";
const HomeScreen = () => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

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
    <>
      <ImageBackground
        source={require("../assets/HomeScreenBackground.png")}
        style={styles.backgroundImage}
      >
        <View style={{ paddingTop: screenWidth > 768 ? 28 : 50 }}>
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
            {inProgressPaths.map((path, index) => (
              <View key={index} style={styles.cardWrapper}>
                <ProgressCard
                  sheajPathNumber={path.number}
                  angNumber={path.ang}
                  progress={path.progress}
                />
              </View>
            ))}
          </ScrollView>

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
            {completedPaths.map((path, index) => (
              <View key={index} style={styles.completedCardWrapper}>
                <CompletedPathCard
                  sehajNumber={path.number}
                  completionDate={path.date}
                />
              </View>
            ))}
          </ScrollView>
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

  //   cardWrapper: {
  //     marginRight: 15,
  //   },
  //   completedCardWrapper: {
  //     marginRight: 15,
  //     marginBottom: 15,
  //   },
  //   completedText: {
  //     fontSize: 16,
  //     color: "#11336A",
  //   },
  //   completedAngText: {
  //     fontSize: 14,
  //     color: "#666666",
  //   },
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
