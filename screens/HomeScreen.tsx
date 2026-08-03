import React, { useCallback, useRef, useState, useMemo } from 'react';
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
  SyncPopup,
  SignInPopup,
  SyncUnavailablePopup,
} from '@components';
import { PathData, useScreenAnalytics, useDrawerNavigation } from '@hooks';
import { recordError, showErrorAlert, trackEvent } from '@utils';
import { Constants, ErrorConstants, Routes, EDGES_ALL_SIDES } from '@constants';
import { HomeScreenStyles, SafeAreaStyle } from '@styles';
import { RootStackParamList } from '../App';
import { MenuIcon } from '@icons';
import { useAppSelector } from '../store/hooks';
import { createPath } from '../store/commands';
import { onForeground } from '../store/syncLifecycle';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen = React.memo(({ navigation }: HomeProps) => {
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const paths = useAppSelector((state) => state.paths.paths);
  const { handleDrawerNavigate } = useDrawerNavigation();
  const isCreatingRef = useRef(false);
  useScreenAnalytics('HomeScreen', 'HomeScreen');

  const { pathInProgress, pathCompleted } = useMemo(() => {
    // Keep "completed" strict: both completionDate and final checkpoint must match.
    const completed = paths.filter((path: PathData) => path.completionDate !== '');
    const inProgress = paths.filter((path: PathData) => path.completionDate === '');
    return { pathInProgress: inProgress, pathCompleted: completed };
  }, [paths]);

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

  // Home is the safe place to pull another device's progress. The lifecycle
  // helper first uploads any local work; it never applies a stale GET response
  // over offline edits.
  useFocusEffect(
    useCallback(() => {
      onForeground();
      return undefined;
    }, [])
  );

  const handleStart = useCallback(async () => {
    // Guard against a rapid double-tap creating two paths (belt-and-braces with
    // the id being allocated inside the command's lock).
    if (isCreatingRef.current) {
      return;
    }
    isCreatingRef.current = true;
    try {
      // Only navigate once the new path is actually durable on disk.
      const newPathId = await createPath();
      if (newPathId === null) {
        showErrorAlert(ErrorConstants.FAILED_TO_CREATE_NEW_SEHAJ_PATH);
        return;
      }
      trackEvent('PathCreated', 'click', 'start new path');
      navigation.push(Routes.Continue, { pathId: newPathId });
    } catch (error) {
      recordError(error, 'HomeScreen: failed to create new sehaj path');
      showErrorAlert(ErrorConstants.FAILED_TO_CREATE_NEW_SEHAJ_PATH);
    } finally {
      isCreatingRef.current = false;
    }
  }, [navigation]);

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
      <SyncPopup mode="unowned" />
      <SignInPopup />
      <SyncUnavailablePopup />
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
          hitSlop={12}
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
