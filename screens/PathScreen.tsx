import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Animated,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { PathScreenStyles } from "../styles/PathScreenStyles";
import NavContent from "../components/NavContent";
import { LeftArrowIcon } from "../icons/LeftArrow.icon";
import { PunjabiNumbers } from "../constants/Number";
import { RightArrowIcon } from "../icons/RightArrow.icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import { BaniDB } from "../utils/BaniDB";
import { HomeIcon } from "../icons/Home.icon";
import { SettingsIcon } from "../icons/Settings.icon";
import { SaveIcon } from "../icons/Save.icon";
import { PlayIcon } from "../icons/Play.icon";
import { useLocal } from "../hooks/useLocal";
import PauseIcon from "../icons/Pause.icon";
import SimpleTextForPath from "../components/SimpleTextForPath";

type PathScreenProps = NativeStackScreenProps<RootStackParamList, "Path">;

export const PathScreen = ({ navigation, route }: PathScreenProps) => {
  const [pathPujabiAng, setPathPunjabiAng] = useState<string>("0");
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathContent, setPathContent] = useState<any>();
  const [autoScroll, setAutoScroll] = useState<boolean>(false);
  const scrollInveral = useRef<NodeJS.Timeout | null>(null);
  const scorllOffset = useRef<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [verseId, setVerseId] = useState<number>(0);
  const [matchedVerseId, setMatchedVerseId] = useState<number>(0);
  const loadingIndicator = useRef<any>();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { fetchFromLocal, handleUpdatePath } = useLocal();

  useEffect(() => {
    const fetchPath = async () => {
      const { pathDataArray } = await fetchFromLocal();
      const matchedPath = pathDataArray.find(
        (path) => path.pathId === route.params.pathId
      );
      if (matchedPath) {
        const pathAng =
          matchedPath.saveData.angNumber == 0
            ? 1
            : matchedPath.saveData.angNumber;
        setMatchedVerseId(matchedPath.saveData.verseId);
        setPathAng(pathAng);
        setPathPunjabiAng(
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
    setPathAng(pageNo + 1);
    setPathPunjabiAng(
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
    setPathAng(pageNo - 1);
    setPathPunjabiAng(
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
  const scrollToMatchedVerse = () => {
    const scrollIndex = pathContent?.page?.findIndex(
      (page: any) => page.verseId === matchedVerseId
    );

    if (scrollIndex !== -1) {
      scorllOffset.current = scrollIndex * 100;
      scrollRef.current?.scrollTo({
        y: scorllOffset.current,
        animated: false,
      });
    }
  };
  const handleAutoScroll = () => {
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
  useEffect(() => {
    if (isSaved) {
      fadeAnim.setValue(1);
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }).start(() => {
        setIsSaving(false);
        setIsSaved(false);
      });
    }
  }, [isSaved]);

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
          <NavContent text={pathPujabiAng} />
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
            <SimpleTextForPath
              key={index}
              gurbaniLine={path.verse.unicode}
              onPress={() => {
                if (isSaving) {
                  setVerseId(index + 1);
                }
              }}
              iconPress={() =>
                handleUpdatePath(
                  route.params.pathId || 1,
                  pathAng,
                  path.verseId,
                  setIsSaved
                )
              }
              isSaving={isSaving}
              verseId={verseId}
              index={index + 1}
            />
          ))}
        </ScrollView>
        {loadingIndicator.current != undefined ? (
          <View style={PathScreenStyles.loadingContainer}>
            {loadingIndicator.current}
            <Text>Loading ...</Text>
          </View>
        ) : (
          ""
        )}

        {!isSaving ? (
          <View style={PathScreenStyles.navigationContainer}>
            <NavContent
              navIcon={<HomeIcon />}
              onPress={() => navigation.push("Home")}
            />
            <NavContent
              navIcon={<SaveIcon />}
              onPress={() => {
                setIsSaving(!isSaving);
                fadeAnim.setValue(1);
              }}
            />
            <NavContent
              navIcon={autoScroll ? <PauseIcon /> : <PlayIcon />}
              onPress={() => setAutoScroll((prev) => !prev)}
            />
            <NavContent navIcon={<SettingsIcon />} />
          </View>
        ) : undefined}
        {isSaving && (
          <Animated.View
            style={{ ...PathScreenStyles.saveContainer, opacity: fadeAnim }}
          >
            <NavContent navIcon={<SaveIcon />} />
            <Text style={PathScreenStyles.saveText}>
              {!isSaved
                ? "Select a panktee to save progress."
                : "Saved the highlighted panktee!"}
            </Text>
          </Animated.View>
        )}
      </View>
    </>
  );
};
