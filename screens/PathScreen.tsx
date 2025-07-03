/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Animated, BackHandler } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BaniDB, showSaveProgressAlert } from '@utils';
import { PunjabiNumbers } from '@constants';
import { PathScreenStyles, SafeAreaStyle } from '@styles';
import { AngsFormat, DateData, PathData, useLocal } from '@hooks/useLocal';
import { useInternet } from '@hooks/useInternet';
import {
  AngsNavigation,
  Loading,
  PathControls,
  Message,
  PathReader,
  PathNavigation,
} from '@components';
import { RootStackParamList } from '../App';

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
    }
  };
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
  const updatePathAng = (angNumber: number) => {
    setPathAng(angNumber);
    if (angsFormat.format === 'Punjabi') {
      setPathPunjabiAng(
        angNumber
          .toString()
          .split('')
          .map((num: string) => PunjabiNumbers[num])
          .join('') || '0'
      );
    } else {
      setPathPunjabiAng(angNumber.toString() || '0');
    }
  };

  const handleGoBack = useCallback(async () => {
    if (isAngNavigation) {
      const { pathDataArray } = await fetchFromLocal();
      const currentMatchedPath = pathDataArray.find((path) => path.pathId === route.params.pathId);
      const lastSavedAngNumber = currentMatchedPath?.saveData.angNumber || 0;

      if (pathAng !== lastSavedAngNumber) {
        showSaveProgressAlert({
          onSaveAndGoBack: () => {
            handleUpdatePath(
              route.params.pathId,
              pathAng,
              savedPathVerseId,
              scorllOffset.current,
              setIsSaved
            );
            setIsAngNavigation(false);
            navigation.push('Home');
          },
          onGoBackWithoutSaving: () => {
            updatePathAng(lastSavedAngNumber);
            navigation.push('Home');
          },
        });
      } else {
        navigation.push('Home');
      }
    } else {
      navigation.push('Home');
    }
  }, [
    isAngNavigation,
    pathAng,
    handleUpdatePath,
    route.params.pathId,
    savedPathVerseId,
    setIsSaved,
    setIsAngNavigation,
    navigation,
    fetchFromLocal,
  ]);

  useEffect(() => {
    const fetchPath = async () => {
      const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
      const matchedPathData = pathDataArray.find((path) => path.pathId === route.params.pathId);
      setMatchedPath(matchedPathData);
      const matchedDate = pathDateDataArray.find((date) => date.pathid === route.params.pathId);
      setMatchedPathDate(matchedDate);
      if (matchedPathData) {
        const pathAngData =
          matchedPathData.saveData.angNumber === 0 ? 1 : matchedPathData.saveData.angNumber;
        setSavedPathVerseId(matchedPathData.saveData.verseId);
        setPathAng(pathAngData);
        setAngNavigationNumber(pathAngData);
        if (angsFormat.format === 'Punjabi') {
          setPathPunjabiAng(
            pathAngData
              ?.toString()
              .split('')
              .map((num: string) => PunjabiNumbers[num])
              .join('') || '0'
          );
        } else {
          setPathPunjabiAng(pathAngData?.toString() || '0');
        }
        await fetchFromBaniDB(pathAngData);
      }
    };
    fetchPath();
  }, []);

  const handleRightArrow = async (pageNo: number) => {
    if (isNavigating) {
      return;
    }
    checkNetwork();
    if (!isOnline) {
      return;
    }
    if (pageNo >= 1430) {
      return;
    }
    setIsNavigating(true);
    setIsSaving(false);
    scorllOffset.current = 0;
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });

    await fetchFromBaniDB(pageNo + 1).finally(() => {
      setIsNavigating(false);
    });
    setAngNavigationNumber(pageNo + 1);
    if (angsFormat.format === 'Punjabi') {
      setPathPunjabiAng(
        (pageNo + 1)
          ?.toString()
          .split('')
          .map((num: string) => PunjabiNumbers[num])
          .join('') || '0'
      );
    } else {
      setPathPunjabiAng((pageNo + 1)?.toString() || '0');
    }
    setPathAng(pageNo + 1);
  };
  const handleLeftArrow = async (pageNo: number) => {
    if (isNavigating) {
      return;
    }
    checkNetwork();
    if (!isOnline) {
      return;
    }
    if (pageNo <= 1) {
      return;
    }
    setIsNavigating(true);
    setIsSaving(false);
    scorllOffset.current = 0;
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
    await fetchFromBaniDB(pageNo - 1).finally(() => {
      setIsNavigating(false);
    });
    setAngNavigationNumber(pageNo - 1);
    if (angsFormat.format === 'Punjabi') {
      setPathPunjabiAng(
        (pageNo - 1)
          ?.toString()
          .split('')
          .map((num: string) => PunjabiNumbers[num])
          .join('') || '0'
      );
    } else {
      setPathPunjabiAng((pageNo - 1)?.toString() || '0');
    }
    setPathAng(pageNo - 1);
  };

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
      const larivaar = await fetchLarivaar();
      setIsLarivaar(larivaar || false);
    };
    fetchLarivaarData();
  });

  useEffect(() => {
    checkNetwork();
  }, []);

  useFocusEffect(() => {
    const fetchAngsFormatData = async () => {
      const format = await fetchAngsFormat();
      setAngsFormat(format);
      if (format.format === 'Punjabi') {
        setPathPunjabiAng(
          pathAng
            .toString()
            .split('')
            .map((num: string) => PunjabiNumbers[num])
            .join('') || '0'
        );
      } else {
        setPathPunjabiAng(pathAng.toString() || '0');
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
          pathId={route.params.pathId || 1}
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
              !isSaved ? 'Select a panktee to save progress.' : 'Saved the highlighted panktee!'
            }
            fadeAnim={fadeAnim}
          />
        )}
        {found && <Message message={'Last saved panktee founded!'} fadeAnim={fadeAnim} />}
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
