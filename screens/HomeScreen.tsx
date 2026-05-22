import React, { useCallback, useRef, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ImageBackground, ScrollView, BackHandler, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  Headline,
  Slider,
  PrimaryButton,
  PrimaryCard,
  SecondaryCard,
  Label,
  DrawerMenu,
} from '@components';
import { PathData, useLocal, useScreenAnalytics, useDrawerNavigation } from '@hooks';
import { showErrorAlert, trackEvent, recordError } from '@utils';
import { Constants, ErrorConstants, Routes, EDGES_ALL_SIDES } from '@constants';
import { HomeScreenStyles, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { MenuIcon } from '@icons';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen = React.memo(({ navigation }: HomeProps) => {
  const [pathDataArrayFromLocal, setPathDataArrayFromLocal] = useState<PathData[]>([]);
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const { fetchFromLocal, handleNewPath } = useLocal();
  const { handleDrawerNavigate } = useDrawerNavigation();
  const errorAlertShownRef = useRef(false);
  const isLoadingRef = useRef(false);
  useScreenAnalytics('HomeScreen', 'HomeScreen');
  const { pathInProgress, pathCompleted } = useMemo(() => {
    // Keep "completed" strict: both completionDate and final checkpoint must match.
    const completed = pathDataArrayFromLocal.filter((path: PathData) => path.completionDate !== '');
    const inProgress = pathDataArrayFromLocal.filter(
      (path: PathData) => path.completionDate === ''
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
      recordError(error, 'HomeScreen: failed to load sehaj paths data');
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
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

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
    trackEvent('PathCreated', 'click', 'start new path');
    try {
      const { pathDataArray, pathDateDataArray, newPathid } = await handleNewPath();
      setPathDataArrayFromLocal(pathDataArray);
      await AsyncStorage.setItem('pathDetails', JSON.stringify(pathDataArray));
      await AsyncStorage.setItem('pathDateDetails', JSON.stringify(pathDateDataArray));
      navigation.push(Routes.Continue, { pathId: newPathid });
    } catch (error) {
      recordError(error, 'HomeScreen: failed to create new sehaj path');
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
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <ImageBackground
        source={require('../assets/Images/HomeScreenBg.png')}
        resizeMode="cover"
        style={HomeScreenStyles.backgroundImage}
      >
        <TouchableOpacity
          style={HomeScreenStyles.menuButton}
          onPress={() => setIsDrawerVisible(true)}
          accessibilityLabel="Menu"
          accessibilityRole="button"
        >
          <MenuIcon color="#0D2346" />
        </TouchableOpacity>
        <ScrollView contentContainerStyle={HomeScreenStyles.scrollContainer}>
          <View style={HomeScreenStyles.container}>
            <Headline headline={Constants.ITS_FINE_DAY_FOR} />
            <Headline headline={Constants.SEHAJ_PATH_ENGLISH} />
            {pathInProgress?.length > 0 ? (
              <View style={HomeScreenStyles.pathInProgressContianer}>
                <Label label={Constants.SEHAJ_PATH_IN_PROGRESS} />
                <Slider arrayOfCards={pathInProgressCards} widthOfCard={199} dotsIndicator={true} />
              </View>
            ) : undefined}
            <PrimaryButton buttonTitle={Constants.START_NEW} onPress={handleStart} />
            {pathCompleted?.length > 0 ? (
              <View style={HomeScreenStyles.pathCompletedContainer}>
                <Label label={Constants.SEHAJ_PATH_COMPLETED} />
                <Slider arrayOfCards={pathCompletedCards} widthOfCard={130} dotsIndicator={false} />
              </View>
            ) : undefined}
          </View>
        </ScrollView>
        <DrawerMenu
          isVisible={isDrawerVisible}
          onClose={() => setIsDrawerVisible(false)}
          onNavigate={handleDrawerNavigate}
          currentRoute={Routes.Home}
          showOnlyHomeItems={true}
        />
      </ImageBackground>
    </SafeAreaView>
  );
});
