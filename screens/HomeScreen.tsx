import { View, ImageBackground, ScrollView, SafeAreaView } from 'react-native';
import React, { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Headline, Slider, PrimaryButton, PrimaryCard, SecondaryCard, Label } from '../components';
import { HomeScreenStyles, SafeAreaStyle } from '@styles/index';
import { Constants } from '@constants';
import { StartIcon } from '../icons';
import { useLocal, PathData } from '../hooks/useLocal';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen = ({ navigation }: HomeProps) => {
  const [pathInProgress, setPathInProgress] = useState<PathData[]>([]);
  const [pathCompleted, setPathCompleted] = useState<PathData[]>([]);
  const { fetchFromLocal, handleNewPath } = useLocal();
  useFocusEffect(
    useCallback(() => {
      const fetch = async () => {
        const { pathDataArray } = await fetchFromLocal();

        setPathCompleted(
          pathDataArray.filter(
            (path: PathData) => path.saveData.angNumber === 1430 && path.saveData.verseId === 60403
          )
        );
        setPathInProgress(
          pathDataArray.filter(
            (path: PathData) => path.saveData.angNumber <= 1430 && path.saveData.verseId < 60403
          )
        );
      };
      fetch();
    }, [fetchFromLocal])
  );

  const handleStart = async () => {
    const { pathDataArray, pathDateDataArray, newPathid } = await handleNewPath();
    setPathInProgress(pathDataArray.filter((path: PathData) => path.saveData.angNumber !== 1430));
    setPathCompleted(
      pathDataArray.filter(
        (path: PathData) => path.saveData.angNumber === 1430 && path.saveData.verseId === 60403
      )
    );
    AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray));
    AsyncStorage.setItem('pathDateDetails', JSON.stringify(pathDateDataArray));
    navigation.push('Continue', { pathId: newPathid });
  };

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <ImageBackground
        source={require('../assets/Images/HomeScreenBg.png')}
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
                      sehajPathName={path.pathName}
                      angNumber={path.saveData.angNumber}
                      progress={path.progress}
                      onPress={() => {
                        navigation.push('Continue', { pathId: path.pathId });
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
                  widthOfCard={130}
                  dotsIndicator={false}
                />
              </View>
            ) : undefined}
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
};
