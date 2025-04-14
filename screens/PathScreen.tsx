import { View, Text, ScrollView } from "react-native";
import React, { useEffect, useState } from "react";
import { PathScreenStyles } from "../styles/PathScreenStyles";
import NavContent from "../components/NavContent";
import { LeftArrow } from "../icons/LeftArrow.icon";
import { PunjabiNumbers } from "../constants/Number";
import { RightArrow } from "../icons/RightArrow.icon";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../App";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BaniDB } from "../utils/BaniDB";
import SimpleText from "../components/SimpleText";

type PathScreenProps = NativeStackScreenProps<RootStackParamList, "Path">;

interface PathData {
  pathId: number;
  angNumber: number;
  progress: number;
  startDate: string;
  completionDate: string;
}

export const PathScreen = ({ navigation, route }: PathScreenProps) => {
  const [pathAng, setPathAng] = useState<string>("0");
  const [pathContent, setPathContent] = useState<any>();
  useEffect(() => {
    const fetchPath = async () => {
      const pathFromLocal = await AsyncStorage.getItem("pathDetails");
      const pathFromLocalArray: PathData[] = pathFromLocal
        ? JSON.parse(pathFromLocal)
        : [];
      const matchedPath = pathFromLocalArray.find(
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
      console.log("Already at last page");
      return;
    }
    setPathAng(
      (pageNo + 1)
        ?.toString()
        .split("")
        .map((num: string) => PunjabiNumbers[num])
        .join("") || "0"
    );
    console.log(pageNo + 1);
    fetchFromBaniDB(pageNo + 1);
  };
  const handleLeftArrow = (pageNo: number) => {
    if (pageNo <= 1) {
      console.log("Already at first page");
      return;
    }
    setPathAng(
      (pageNo - 1)
        ?.toString()
        .split("")
        .map((num: string) => PunjabiNumbers[num])
        .join("") || "0"
    );
    fetchFromBaniDB(pageNo - 1);
  };
  const fetchFromBaniDB = async (angNumber: number) => {
    const pathFromBaniDB = await BaniDB(angNumber);
    setPathContent(pathFromBaniDB);
  };
  return (
    <>
      <View style={PathScreenStyles.container}>
        <View style={PathScreenStyles.navContainer}>
          <NavContent
            navIcon={<LeftArrow />}
            onPress={() => {
              handleLeftArrow(pathContent?.source?.pageNo);
            }}
          />
          <NavContent text={pathAng} />
          <NavContent
            navIcon={<RightArrow />}
            onPress={() => {
              handleRightArrow(pathContent?.source?.pageNo);
            }}
          />
        </View>
        <ScrollView
          contentContainerStyle={PathScreenStyles.pathContentContainer}
        >
          {pathContent?.page?.map((path: any, index: number) => (
            <SimpleText
              key={index}
              simpleText={path.verse.unicode}
              simpleTextStyle={PathScreenStyles.pathContent}
            />
          ))}
        </ScrollView>
      </View>
    </>
  );
};
