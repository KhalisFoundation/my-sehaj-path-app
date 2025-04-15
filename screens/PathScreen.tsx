import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { PathScreenStyles } from "../styles/PathScreenStyles";
import NavContent from "../components/NavContent";
import { LeftArrowIcon } from "../icons/LeftArrow.icon";
import { PunjabiNumbers } from "../constants/Number";
import { RightArrowIcon } from "../icons/RightArrow.icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BaniDB } from "../utils/BaniDB";
import SimpleText from "../components/SimpleText";
import { HomeIcon } from "../icons/Home.icon";
import { SettingsIcon } from "../icons/Settings.icon";
import { SaveIcon } from "../icons/Save.icon";
import { PlayIcon } from "../icons/Play.icon";
import { useLocal } from "../hooks/useLocal";
import { Rect, Svg } from "react-native-svg";
import PauseIcon from "../icons/Pause.icon";

type PathScreenProps = NativeStackScreenProps<RootStackParamList, "Path">;

export const PathScreen = ({ navigation, route }: PathScreenProps) => {
  const [pathAng, setPathAng] = useState<string>("0");
  const [pathContent, setPathContent] = useState<any>();
  const [autoScroll, setAutoScroll] = useState<boolean>(false);
  const scrollInveral = useRef<NodeJS.Timeout | null>(null);
  const scorllOffset = useRef<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const loadingIndicator = useRef<any>();
  const { fetchFromLocal } = useLocal();
  const { width, height } = Dimensions.get("window");
  useEffect(() => {
    const fetchPath = async () => {
      const { pathDataArray } = await fetchFromLocal();
      const matchedPath = pathDataArray.find(
        (path) => path.pathId === route.params.pathId
      );
      if (matchedPath) {
        const pathAng = matchedPath.angNumber == 0 ? 1 : matchedPath.angNumber;
        setPathAng(
          pathAng
            ?.toString()
            .split("")
            .map((num: string) => PunjabiNumbers[num])
            .join("") || "0"
        );
        fetchFromBaniDB(pathAng);
      }
    };
    fetchPath();
  }, []);
  const handleRightArrow = (pageNo: number) => {
    if (pageNo >= 1430) {
      return;
    }
    scorllOffset.current = 0;
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
    setPathAng(
      (pageNo + 1)
        ?.toString()
        .split("")
        .map((num: string) => PunjabiNumbers[num])
        .join("") || "0"
    );
    loadingIndicator.current = (
      <ActivityIndicator size={"large"} color={"#000"} />
    );
    fetchFromBaniDB(pageNo + 1);
  };
  const handleLeftArrow = (pageNo: number) => {
    if (pageNo <= 1) {
      return;
    }
    scorllOffset.current = 0;
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
    setPathAng(
      (pageNo - 1)
        ?.toString()
        .split("")
        .map((num: string) => PunjabiNumbers[num])
        .join("") || "0"
    );
    loadingIndicator.current = (
      <ActivityIndicator size={"large"} color={"#000"} />
    );
    fetchFromBaniDB(pageNo - 1);
  };
  const fetchFromBaniDB = async (angNumber: number) => {
    const pathFromBaniDB = await BaniDB(angNumber);
    setPathContent(pathFromBaniDB);
    loadingIndicator.current = undefined;
  };
  const handleAutoScroll = () => {
    console.log("scrolling to:", scorllOffset.current);

    scrollInveral.current = setInterval(() => {
      scorllOffset.current += 1;
      scrollRef.current?.scrollTo({
        y: scorllOffset.current,
        animated: false,
      });
    }, 0);
  };
  const handleStopAutoScroll = () => {
    if (scrollInveral.current) {
      clearInterval(scrollInveral.current);
      scrollInveral.current = null;
      setAutoScroll(false);
    }
  };
  useEffect(() => {
    if (autoScroll) {
      handleAutoScroll();
    } else {
      handleStopAutoScroll();
    }
    return () => handleStopAutoScroll();
  }, [autoScroll]);
  return (
    <>
      <View style={PathScreenStyles.container}>
        <View style={PathScreenStyles.navContainer}>
          <NavContent
            navIcon={<LeftArrowIcon />}
            onPress={() => {
              handleLeftArrow(pathContent?.source?.pageNo);
            }}
          />
          <NavContent text={pathAng} />
          <NavContent
            navIcon={<RightArrowIcon />}
            onPress={() => {
              handleRightArrow(pathContent?.source?.pageNo);
            }}
          />
        </View>
        <ScrollView
          contentContainerStyle={PathScreenStyles.pathContentContainer}
          ref={scrollRef}
          onScroll={(e) => {
            scorllOffset.current = e.nativeEvent.contentOffset.y;
          }}
          onTouchStart={() => handleStopAutoScroll()}
          scrollEventThrottle={16}
        >
          {pathContent?.page?.map((path: any, index: number) => (
            <SimpleText
              key={index}
              simpleText={path.verse.unicode}
              simpleTextStyle={PathScreenStyles.pathContent}
            />
          ))}
        </ScrollView>
        {loadingIndicator.current != undefined ? ( // for showing loading indicator
          <View
            style={{
              position: "absolute",
              top: height / 2 - 50,
              left: width / 2 - (width * 0.8) / 2,
              zIndex: 9,
              backgroundColor: "white",
              width: "80%",
              height: "10%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {loadingIndicator.current}
            <Text>Loading ...</Text>
          </View>
        ) : (
          ""
        )}

        <View style={PathScreenStyles.navigationContainer}>
          <NavContent
            navIcon={<HomeIcon />}
            onPress={() => navigation.push("Home")}
          />
          <NavContent navIcon={<SaveIcon />} />
          <NavContent
            navIcon={autoScroll ? <PauseIcon /> : <PlayIcon />}
            onPress={() => setAutoScroll((prev) => !prev)}
          />
          <NavContent navIcon={<SettingsIcon />} />
        </View>
      </View>
    </>
  );
};
