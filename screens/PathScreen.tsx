/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Animated, BackHandler } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaniDB, showErrorAlert, convertNumberToFormat } from '@utils';
import { PathScreenStyles, SafeAreaStyle } from '@styles';
import {
  DateData,
  PathData,
  useLocal,
  useInternet,
  useNavigation,
  usePathNavigation,
  useScrollToSavedPath,
  AngsFormat,
} from '@hooks';
import {
  AngsNavigation,
  Loading,
  PathControls,
  Message,
  PathReader,
  PathNavigation,
} from '@components';
import { RootStackParamList } from '../App';
import { ErrorConstants, Constants, Routes } from '@constants';
import { useScreenAnalytics } from '@hooks';

type PathScreenProps = NativeStackScreenProps<RootStackParamList, 'Path'>;

export const PathScreen = React.memo(({ navigation, route }: PathScreenProps) => {
  const [pathPujabiAng, setPathPunjabiAng] = useState<string>('0');
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathContent, setPathContent] = useState<any>();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedPathVerseId, setSavedPathVerseId] = useState<number>(0);
  const [pressIndex, setPressIndex] = useState<number>(0);
  const [found, setFound] = useState<boolean>(false);
  const [isLarivaar, setIsLarivaar] = useState<boolean>(false);
  const [matchedPath, setMatchedPath] = useState<PathData>();
  const [matchedPathDate, setMatchedPathDate] = useState<DateData>();
  const [angsFormat, setAngsFormat] = useState<AngsFormat>({ format: 'Punjabi' });
  const [isAngsNavigationVisible, setIsAngsNavigationVisible] = useState<boolean>(false);
  const [isAngNavigation, setIsAngNavigation] = useState<boolean>(false);
  const [angNavigationNumber, setAngNavigationNumber] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [needsRetry, setNeedsRetry] = useState<boolean>(false);
  const [lastFailedAng, setLastFailedAng] = useState<number | null>(null);
  const scrolledToSavedPath = useRef<boolean>(false);
  const scorllOffset = useRef<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const alertIndicator = useRef<React.ReactNode>();
  const alertText = useRef<string>('Loading ... ');
  const debounceTimer = useRef<NodeJS.Timeout | void | null>(null);
  const fadeAnim = useRef(new Animated.Value(1));
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { checkNetwork, isOnline } = useInternet();
  const { fetchFromLocal, handleUpdatePath, fetchLarivaar, fetchFontSize, fetchAngsFormat } =
    useLocal();

  useScreenAnalytics('PathScreen', 'PathScreen');

  const fetchFromBaniDB = async (angNumber: number) => {
    alertIndicator.current = <ActivityIndicator size={'large'} color={'#000'} />;
    const pathFromBaniDB = await BaniDB(angNumber);
    setPathContent(pathFromBaniDB.data);
    setNeedsRetry(false);
    setLastFailedAng(null);
    setIsSaving(false);
    setIsSaved(false);
    setPressIndex(0);
    setFound(false);
    if (pathFromBaniDB.success === false) {
      const isConnected = await checkNetwork();
      if (!isConnected) {
        setNeedsRetry(true);
        setLastFailedAng(angNumber);
        showErrorAlert(
          ErrorConstants.NO_INTERNET_TITLE + '\n' + ErrorConstants.NO_INTERNET_MESSAGE
        );
      } else {
        navigation.replace(Routes.Error);
        return;
      }
    }
    alertIndicator.current = undefined;
    const currentDebounceTimer = debounceTimer.current;
    if (currentDebounceTimer) {
      clearTimeout(currentDebounceTimer);
      debounceTimer.current = null;
    }
    scorllOffset.current = 0;
    scrollRef.current?.scrollTo({
      y: 0,
      animated: false,
    });
  };

  const { handleRightArrow, handleLeftArrow } = useNavigation({
    isNavigating,
    setIsNavigating,
    setIsSaving,
    scorllOffset,
    scrollRef,
    setAngNavigationNumber,
    setPathPunjabiAng,
    setPathAng,
    angsFormat,
    checkNetwork,
    fetchFromBaniDB,
  });

  const debouncedScrollSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = Animated.timing(new Animated.Value(0), {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      handleUpdatePath(route.params.pathId, pathAng, savedPathVerseId, scorllOffset.current, () => {
        setIsSaved(false);
      });
    });
  }, [handleUpdatePath]);

  const { scrollToSavedPathData } = useScrollToSavedPath({
    matchedPathDate,
    pathContent,
    savedPathVerseId,
    scrolledToSavedPath,
    scrollRef,
    scorllOffset,
    fadeAnim: fadeAnim.current,
    setFound,
    setIsSaving,
    setIsSaved,
    fetchFontSize,
  });

  const updatePathAng = useCallback(
    (angNumber: number) => {
      setPathAng(angNumber);
      setPathPunjabiAng(
        convertNumberToFormat({
          number: angNumber,
          format: angsFormat.format,
        })
      );
      setIsSaving(false);
      setIsSaved(false);
      setPressIndex(0);
      setFound(false);
    },
    [angsFormat.format]
  );

  const { handleGoBack } = usePathNavigation({
    isAngNavigation,
    pathAng,
    savedPathVerseId,
    pathId: route.params.pathId,
    setIsSaved,
    setIsAngNavigation,
    updatePathAng,
    scorllOffset,
    navigation,
  });

  useEffect(() => {
    scrolledToSavedPath.current = false;
    const fetchPath = async () => {
      try {
        const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
        const matchedPathData = pathDataArray.find(
          (path: PathData) => path.pathId === route.params.pathId
        );
        const matchedPathDateData = pathDateDataArray.find(
          (pathDate: DateData) => pathDate.pathid === route.params.pathId
        );
        if (matchedPathData) {
          setMatchedPath(matchedPathData);
          setMatchedPathDate(matchedPathDateData);
          const pathAngData =
            matchedPathData.saveData.angNumber === 0 ? 1 : matchedPathData.saveData.angNumber;
          setSavedPathVerseId(matchedPathData.saveData.verseId);
          setPathAng(pathAngData);
          setAngNavigationNumber(pathAngData);
          setPathPunjabiAng(
            convertNumberToFormat({
              number: pathAngData,
              format: angsFormat.format,
            })
          );

          scrolledToSavedPath.current = false;
          await fetchFromBaniDB(pathAngData);
        }
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PATH_DATA_GENERIC, () => fetchPath(), 'Retry');
      }
    };
    fetchPath();
  }, [route.params.pathId]);

  useEffect(() => {
    if (isSaved || found) {
      fadeAnim.current.setValue(1);
      Animated.timing(fadeAnim.current, {
        toValue: 0,
        duration: 2500,
        useNativeDriver: true,
      }).start(() => {
        setIsSaved(false);
        setIsSaving(false);
        Animated.timing(new Animated.Value(0), {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setFound(false);
        });
      });
    }
    return () => {
      fadeAnim.current.stopAnimation();
    };
  }, [isSaved, found]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (pathAng === matchedPath?.saveData.angNumber && pathContent) {
      animation = Animated.timing(new Animated.Value(0), {
        toValue: 1,
        duration: 10,
        useNativeDriver: true,
      });
      animation.start(() => {
        scrollToSavedPathData();
      });
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [matchedPath, pathAng, pathContent]);

  useFocusEffect(() => {
    const fetchLarivaarData = async () => {
      try {
        const larivaar = await fetchLarivaar();
        setIsLarivaar(larivaar || false);
      } catch (error) {
        setIsLarivaar(false);
      }
    };
    fetchLarivaarData();
  });

  useFocusEffect(() => {
    const fetchAngsFormatData = async () => {
      try {
        const format = await fetchAngsFormat();
        setAngsFormat(format);
        setPathPunjabiAng(
          convertNumberToFormat({
            number: pathAng,
            format: format.format,
          })
        );
      } catch (error) {
        setAngsFormat({ format: 'Punjabi' });
        setPathPunjabiAng(convertNumberToFormat({ number: pathAng, format: 'Punjabi' }));
      }
    };
    fetchAngsFormatData();
  });

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [handleGoBack])
  );

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }

      fadeAnim.current.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (isOnline && needsRetry && lastFailedAng !== null) {
      setNeedsRetry(false);
      fetchFromBaniDB(lastFailedAng);
    }
  }, [isOnline, needsRetry, lastFailedAng]);

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <View style={PathScreenStyles.container}>
        <View>
          <PathNavigation
            pathPujabiAng={pathPujabiAng}
            pathAng={pathAng}
            handleLeftArrow={handleLeftArrow}
            handleRightArrow={handleRightArrow}
            setIsAngsNavigationVisible={setIsAngsNavigationVisible}
          />
        </View>
        <PathReader
          pathContent={pathContent}
          isLarivaar={isLarivaar}
          isSaving={isSaving}
          pressIndex={pressIndex}
          savedPathVerseId={savedPathVerseId}
          scrollRef={scrollRef}
          scorllOffset={scorllOffset}
          isAngNavigation={isAngNavigation}
          debouncedScrollSave={debouncedScrollSave}
          handleRightArrow={handleRightArrow}
          handleLeftArrow={handleLeftArrow}
          setPressIndex={setPressIndex}
          setSavedPathVerseId={setSavedPathVerseId}
          handleUpdatePath={handleUpdatePath}
          setIsSaving={setIsSaving}
          setIsSaved={setIsSaved}
          pathId={route.params.pathId}
          isNavigating={isNavigating}
          found={found}
          setFound={setFound}
        />
        {alertIndicator.current !== undefined ? (
          <Loading alertIndicator={alertIndicator.current} alertText={alertText.current} />
        ) : null}

        {!isSaving && !found ? (
          <View style={PathScreenStyles.navigationContainer}>
            <PathControls
              handleGoBack={handleGoBack}
              setIsSaving={setIsSaving}
              fadeAnim={fadeAnim}
              navigation={navigation}
            />
          </View>
        ) : undefined}
        {isSaving && (
          <Message
            message={
              !isSaved
                ? Constants.SELECT_A_PANKTEE_TO_SAVE_PROGRESS
                : Constants.SAVED_THE_HIGHLIGHTED_PANKTEE
            }
            fadeAnim={fadeAnim.current}
          />
        )}
        {found && (
          <Message message={Constants.RESUMING_SAVED_PROGRESS} fadeAnim={fadeAnim.current} />
        )}
        {isAngsNavigationVisible && (
          <AngsNavigation
            setIsAngsNavigationVisible={setIsAngsNavigationVisible}
            handleRightArrow={() => handleRightArrow(pathAng)}
            handleLeftArrow={() => handleLeftArrow(pathAng)}
            angNavigationNumber={angNavigationNumber}
            setAngNavigationNumber={setAngNavigationNumber}
            isAngNavigation={isAngNavigation}
            setIsAngNavigation={setIsAngNavigation}
            fetchAngData={fetchFromBaniDB}
            updatePathAng={updatePathAng}
          />
        )}
      </View>
    </SafeAreaView>
  );
});
