/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Animated, BackHandler } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaniDB, showErrorAlert, convertNumberToFormat } from '@utils';
import { PathScreenStyles, SafeAreaStyle } from '@styles';
import {
  AngsFormat,
  DateData,
  PathData,
  useLocal,
  useInternet,
  useNavigation,
  usePathNavigation,
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
import { ErrorConstants, Constants } from '@constants';

type PathScreenProps = NativeStackScreenProps<RootStackParamList, 'Path'>;

export const PathScreen = ({ navigation, route }: PathScreenProps) => {
  const [pathPujabiAng, setPathPunjabiAng] = useState<string>('0');
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathContent, setPathContent] = useState<any>();
  const [autoScroll, setAutoScroll] = useState<boolean>(false);
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
  const scrolledToSavedPath = useRef(false);
  const scrollInveral = useRef<NodeJS.Timeout | null>(null);
  const scorllOffset = useRef<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const aleartIndicator = useRef<any>();
  const alertText = useRef<string>('Loading ... ');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { checkNetwork, isOnline } = useInternet();
  const { fetchFromLocal, handleUpdatePath, fetchLarivaar, fetchFontSize, fetchAngsFormat } =
    useLocal();

  const fetchFromBaniDB = async (angNumber: number) => {
    aleartIndicator.current = <ActivityIndicator size={'large'} color={'#000'} />;
    const pathFromBaniDB = await BaniDB(angNumber);
    setPathContent(pathFromBaniDB);
    if (pathFromBaniDB === 'Error') {
      navigation.replace('Error');
    }
    aleartIndicator.current = undefined;
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
    isOnline,
    fetchFromBaniDB,
  });

  const debouncedScrollSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      handleUpdatePath(
        route.params.pathId,
        pathAng,
        savedPathVerseId,
        scorllOffset.current,
        setIsSaved
      );
    }, 300);
  }, [handleUpdatePath]);

  const scrollToSavedPathData = async () => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    if (matchedPathDate && !scrolledToSavedPath.current) {
      setFound(true);
      const scrollY = matchedPathDate.scrollPosition;
      scorllOffset.current = scrollY;
      scrollRef.current?.scrollTo({
        y: scorllOffset.current,
        animated: true,
      });
      scrolledToSavedPath.current = true;

      scrollTimeoutRef.current = setTimeout(() => {
        setFound(false);
        fadeAnim.setValue(1);
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }).start(() => {
          setIsSaving(false);
          setIsSaved(false);
        });
      }, 2000);
    }
    if (pathContent && !scrolledToSavedPath.current) {
      try {
        const scrollIndex = pathContent?.page?.findIndex(
          (page: any) => page.verseId === savedPathVerseId
        );
        const fontSize = await fetchFontSize();
        const fontSizeNumber = fontSize.number;
        let scrollHeight;
        if (fontSizeNumber <= 18) {
          scrollHeight = 25;
        } else if (fontSizeNumber <= 24) {
          scrollHeight = 50;
        } else if (fontSizeNumber <= 30) {
          scrollHeight = 100;
        } else {
          scrollHeight = 150;
        }
        if (scrollIndex !== -1) {
          const scrollY = scrollIndex * scrollHeight;
          setFound(true);
          scorllOffset.current = scrollY;
          scrollRef.current?.scrollTo({
            y: scorllOffset.current,
            animated: true,
          });
          scrolledToSavedPath.current = true;
        }
        scrollTimeoutRef.current = setTimeout(() => {
          setFound(false);
          fadeAnim.setValue(1);
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 2500,
            useNativeDriver: true,
          }).start(() => {
            setIsSaving(false);
            setIsSaved(false);
          });
        }, 2000);
      } catch (error) {
        showErrorAlert(ErrorConstants.ERROR_SCROLLING_TO_SAVED_PATH);
      }
    }
  };
  const updatePathAng = (angNumber: number) => {
    setPathAng(angNumber);
    setPathPunjabiAng(convertNumberToFormat(angNumber, angsFormat.format as 'Punjabi' | 'English'));
  };

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
    const fetchPath = async () => {
      try {
        const { pathDataArray, pathDateDataArray } = await fetchFromLocal(navigation);
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
            convertNumberToFormat(pathAngData, angsFormat.format as 'Punjabi' | 'English')
          );
          await fetchFromBaniDB(pathAngData);
        }
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PATH_DATA_GENERIC, () => fetchPath(), 'Retry');
      }
    };
    fetchPath();
  }, []);

  const handleAutoScroll = () => {
    scrollInveral.current = setInterval(() => {
      scorllOffset.current += 1;
      scrollRef.current?.scrollTo({
        y: scorllOffset.current,
        animated: false,
      });
    }, 50);
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
    if (isSaved || found) {
      fadeAnim.setValue(1);
      const timeoutId = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }).start(() => {
          setIsSaving(false);
          setIsSaved(false);
        });
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [isSaved, found]);

  useEffect(() => {
    if (pathAng === matchedPath?.saveData.angNumber && pathContent) {
      const timeoutId = setTimeout(() => {
        scrollToSavedPathData();
      }, 800);

      return () => clearTimeout(timeoutId);
    }
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

  useEffect(() => {
    checkNetwork();
  }, []);

  useFocusEffect(() => {
    const fetchAngsFormatData = async () => {
      try {
        const format = await fetchAngsFormat();
        setAngsFormat(format);
        setPathPunjabiAng(convertNumberToFormat(pathAng, format.format as 'Punjabi' | 'English'));
      } catch (error) {
        setAngsFormat({ format: 'Punjabi' });
        setPathPunjabiAng(convertNumberToFormat(pathAng, 'Punjabi'));
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
      if (scrollInveral.current) {
        clearInterval(scrollInveral.current);
        scrollInveral.current = null;
      }
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
      <View style={PathScreenStyles.container}>
        <View style={PathScreenStyles.navContainer}>
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
          handleStopAutoScroll={handleStopAutoScroll}
          handleRightArrow={handleRightArrow}
          handleLeftArrow={handleLeftArrow}
          setPressIndex={setPressIndex}
          setSavedPathVerseId={setSavedPathVerseId}
          handleUpdatePath={handleUpdatePath}
          setIsSaving={setIsSaving}
          setIsSaved={setIsSaved}
          pathId={route.params.pathId}
        />
        {aleartIndicator.current !== undefined ? (
          <Loading alertIndicator={aleartIndicator.current} alertText={alertText.current} />
        ) : null}

        {!isSaving && !found ? (
          <View style={PathScreenStyles.navigationContainer}>
            <PathControls
              handleGoBack={handleGoBack}
              setIsSaving={setIsSaving}
              isSaving={isSaving}
              fadeAnim={fadeAnim}
              autoScroll={autoScroll}
              setAutoScroll={setAutoScroll}
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
            fadeAnim={fadeAnim}
          />
        )}
        {found && <Message message={Constants.LAST_SAVED_PANKTEE_FOUNDED} fadeAnim={fadeAnim} />}
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
};
