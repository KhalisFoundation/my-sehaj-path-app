import React, { useCallback, useRef, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ImageBackground, ScrollView, SafeAreaView, BackHandler } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Headline, Slider, PrimaryButton, PrimaryCard, SecondaryCard, Label } from '@components';
import { Constants, ErrorConstants, Routes } from '@constants';
import { PathData, useLocal } from '@hooks';
import { showErrorAlert } from '@utils';
import { HomeScreenStyles, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen = React.memo(({ navigation }: HomeProps) => {
  const [pathDataArrayFromLocal, setPathDataArrayFromLocal] = useState<PathData[]>([]);
  const { fetchFromLocal, handleNewPath } = useLocal();
  const errorAlertShownRef = useRef(false);
  const isLoadingRef = useRef(false);

  const { pathInProgress, pathCompleted } = useMemo(() => {
    const completed = pathDataArrayFromLocal.filter(
      (path: PathData) => path.saveData.angNumber === 1430 && path.saveData.verseId === 60403
    );
    const inProgress = pathDataArrayFromLocal.filter(
      (path: PathData) => path.saveData.angNumber <= 1430 && path.saveData.verseId < 60403
    );
    return { pathInProgress: inProgress, pathCompleted: completed };
  }, [pathDataArrayFromLocal]);

  const loadData = useCallback(async () => {
    if (isLoadingRef.current) {
      return;
    }
    isLoadingRef.current = true;
    errorAlertShownRef.current = false;
    try {
      const { pathDataArray } = await fetchFromLocal();
      setPathDataArrayFromLocal(pathDataArray);
    } catch (error) {
      if (!errorAlertShownRef.current) {
        errorAlertShownRef.current = true;
        showErrorAlert(
          ErrorConstants.FAILED_TO_LOAD_SEHAJ_PATHS_DATA,
          async () => {
            errorAlertShownRef.current = false;
            await loadData();
          },
          'Retry'
        );
      }
    } finally {
      isLoadingRef.current = false;
    }
  }, [fetchFromLocal]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useFocusEffect(
    useCallback(() => {
      let timeoutId: NodeJS.Timeout | null = null;

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        timeoutId = setTimeout(() => {
          BackHandler.exitApp();
        }, 100);
        return true;
      });

      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        backHandler.remove();
      };
    }, [])
  );

  const handleStart = useCallback(async () => {
    try {
      const { pathDataArray, pathDateDataArray, newPathid } = await handleNewPath();
      setPathDataArrayFromLocal(pathDataArray);
      await AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray));
      await AsyncStorage.setItem('pathDateDetails', JSON.stringify(pathDateDataArray));
      navigation.push(Routes.Continue, { pathId: newPathid });
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_CREATE_NEW_SEHAJ_PATH);
    }
  }, [handleNewPath, navigation]);

  const pathInProgressCards = useMemo(
    () =>
      pathInProgress?.map((path: PathData) => (
        <PrimaryCard
          key={path.pathId}
          sehajPathName={path.pathName}
          angNumber={path.saveData.angNumber}
          progress={path.progress}
          onPress={() => {
            navigation.push(Routes.Continue, { pathId: path.pathId });
          }}
        />
      )),
    [pathInProgress, navigation]
  );

  const pathCompletedCards = useMemo(
    () =>
      pathCompleted.map((path: PathData) => (
        <SecondaryCard
          key={path.pathId}
          pathName={path.pathName}
          pathCompletionDate={path.completionDate}
        />
      )),
    [pathCompleted]
  );

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <ImageBackground
        source={require('../assets/Images/HomeScreenBg.png')}
        resizeMode="cover"
        style={HomeScreenStyles.backgroundImage}
      >
        <ScrollView contentContainerStyle={HomeScreenStyles.scrollContainer}>
          <View style={HomeScreenStyles.container}>
            <Headline headline={Constants.ITS_FINE_DAY_TO_CONTINUE} />
            <Headline headline={Constants.YOUR_SEHAJ_PATH} />
            {pathInProgress?.length > 0 ? (
              <View style={HomeScreenStyles.pathInProgressContianer}>
                <Label label={`${Constants.SEHAJ_PATH_IN_PROGRESS} :`} />
                <Slider arrayOfCards={pathInProgressCards} widthOfCard={199} dotsIndicator={true} />
              </View>
            ) : undefined}
            <PrimaryButton buttonTitle={Constants.START_NEW} onPress={handleStart} />
            {pathCompleted?.length > 0 ? (
              <View style={HomeScreenStyles.pathCompletedContainer}>
                <Label label={`${Constants.SEHAJ_PATH_COMPLETED} :`} />
                <Slider arrayOfCards={pathCompletedCards} widthOfCard={130} dotsIndicator={false} />
              </View>
            ) : undefined}
          </View>
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
});
