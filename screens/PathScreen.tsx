/* eslint-disable react-hooks/exhaustive-deps */
import { View, Text, ScrollView, ActivityIndicator, Animated, BackHandler } from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PathScreenStyles } from '@styles';
import { PunjabiNumbers } from '@constants';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { BaniDB } from '@utils/BaniDB';
import { DateData, PathData, useLocal } from '../hooks/useLocal';
import { NavContent, SimpleTextForPath } from '@components';
import { useFocusEffect } from '@react-navigation/native';
import {
  HomeIcon,
  SettingsIcon,
  SaveIcon,
  PlayIcon,
  PauseIcon,
  LeftArrowIcon,
  RightArrowIcon,
} from '../icons';
import { useInternet } from '@hooks/useInternet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SafeAreaStyle } from '@styles/SafeAreaStyle';
import GestureRecognizer from 'react-native-swipe-gestures';

type PathScreenProps = NativeStackScreenProps<RootStackParamList, 'Path'>;

export const PathScreen = ({ navigation, route }: PathScreenProps) => {
  const [pathPujabiAng, setPathPunjabiAng] = useState<string>('0');
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathContent, setPathContent] = useState<any>();
  const [autoScroll, setAutoScroll] = useState<boolean>(false);
  const scrollInveral = useRef<NodeJS.Timeout | null>(null);
  const scorllOffset = useRef<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [matchedVerseId, setMatchedVerseId] = useState<number>(0);
  const [pressIndex, setPressIndex] = useState<number>(0);
  const aleartIndicator = useRef<any>();
  const alertText = useRef<string>('Loading ... ');
  const [found, setFound] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isLarivaar, setIsLarivaar] = useState<boolean>(false);
  const [matchedPath, setMatchedPath] = useState<PathData>();
  const [matchedPathDate, setMatchedPathDate] = useState<DateData>();
  const { checkNetwork, isOnline } = useInternet();
  const { fetchFromLocal, handleUpdatePath, fetchLarivaar } = useLocal();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const debouncedScrollSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      handleUpdatePath(
        route.params.pathId,
        pathAng,
        matchedVerseId,
        scorllOffset.current,
        setIsSaved
      );
    }, 300);
  }, [handleUpdatePath]);

  const scrollToSavedPathData = () => {
    if (matchedPathDate) {
      const scrollY = matchedPathDate.scrollPosition;
      scorllOffset.current = scrollY;
      scrollRef.current?.scrollTo({
        y: scorllOffset.current,
        animated: true,
      });
    }
    if (matchedVerseId) {
      setFound(true);
    }
    setTimeout(() => {
      setMatchedVerseId(0);
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
  };
  const fetchFromBaniDB = async (angNumber: number) => {
    aleartIndicator.current = <ActivityIndicator size={'large'} color={'#000'} />;
    const pathFromBaniDB = await BaniDB(angNumber);
    setPathContent(pathFromBaniDB);
    if (pathFromBaniDB === 'Error') {
      navigation.replace('Error');
    }
    aleartIndicator.current = undefined;
  };

  useEffect(() => {
    const fetchPath = async () => {
      const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
      const matchedPath = pathDataArray.find((path) => path.pathId === route.params.pathId);
      setMatchedPath(matchedPath);
      const matchedDate = pathDateDataArray.find((date) => date.pathid === route.params.pathId);
      setMatchedPathDate(matchedDate);
      if (matchedPath) {
        const pathAng = matchedPath.saveData.angNumber === 0 ? 1 : matchedPath.saveData.angNumber;
        setMatchedVerseId(matchedPath.saveData.verseId);
        setPathAng(pathAng);
        setPathPunjabiAng(
          pathAng
            ?.toString()
            .split('')
            .map((num: string) => PunjabiNumbers[num])
            .join('') || '0'
        );
        await fetchFromBaniDB(pathAng);
      }
    };
    fetchPath();
  }, []);

  const handleRightArrow = (pageNo: number) => {
    checkNetwork();
    if (!isOnline) {
      return;
    }
    if (pageNo >= 1430) {
      return;
    }
    setIsSaving(false);
    scorllOffset.current = 0;
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });

    fetchFromBaniDB(pageNo + 1);
    setPathAng(pageNo + 1);
    setPathPunjabiAng(
      (pageNo + 1)
        ?.toString()
        .split('')
        .map((num: string) => PunjabiNumbers[num])
        .join('') || '0'
    );
  };
  const handleLeftArrow = (pageNo: number) => {
    checkNetwork();
    if (!isOnline) {
      return;
    }
    if (pageNo <= 1) {
      return;
    }
    setIsSaving(false);
    scorllOffset.current = 0;
    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
    setPathAng(pageNo - 1);
    setPathPunjabiAng(
      (pageNo - 1)
        ?.toString()
        .split('')
        .map((num: string) => PunjabiNumbers[num])
        .join('') || '0'
    );

    fetchFromBaniDB(pageNo - 1);
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
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }).start(() => {
          setIsSaving(false);
          setIsSaved(false);
        });
      }, 500);
    }
  }, [isSaved, found]);
  useEffect(() => {
    if (pathAng === matchedPath?.saveData.angNumber) {
      setTimeout(() => {
        scrollToSavedPathData();
      }, 500);
    }
  }, [matchedPath, pathAng]);
  useFocusEffect(() => {
    const fetchFromLocal = async () => {
      const larivaar = await fetchLarivaar();
      setIsLarivaar(larivaar || false);
    };
    fetchFromLocal();
  });
  useFocusEffect(
    useCallback(() => {
      const handleBackPress = async () => {
        const { pathDataArray } = await fetchFromLocal();
        const matchedPath = pathDataArray.find((path) => path.pathId === route.params.pathId);
        if (matchedPath?.saveData.angNumber === pathAng) {
          navigation.goBack();
          return true;
        } else {
          alertText.current = 'Saving Your Progress ... ';
          aleartIndicator.current = <ActivityIndicator size={'large'} color={'#000'} />;
          await handleUpdatePath(
            route.params.pathId,
            pathAng,
            matchedVerseId,
            scorllOffset.current,
            setIsSaved
          );
          setTimeout(() => {
            navigation.goBack();
          }, 1000);
          return true;
        }
      };

      const handleBackPressWrapper = async () => {
        return handleBackPress()
          .then((result) => {
            return result;
          })
          .catch(() => {
            return false;
          });
      };

      BackHandler.addEventListener('hardwareBackPress', handleBackPressWrapper);
      return () => {
        BackHandler.removeEventListener('hardwareBackPress', handleBackPressWrapper);
      };
    }, [navigation, pathAng, route.params.pathId])
  );
  useEffect(() => {
    checkNetwork();
  }, []);
  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView}>
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
        <GestureRecognizer
        // onSwipeLeft={() => handleRightArrow(pathContent?.source?.pageNo)}
        // onSwipeRight={() => handleLeftArrow(pathContent?.source?.pageNo)}
        // onSwipeDown={() => undefined}
        // onSwipeUp={() => undefined}
        >
          <ScrollView
            contentContainerStyle={PathScreenStyles.pathContentContainer}
            ref={scrollRef}
            onScroll={(e) => {
              scorllOffset.current = e.nativeEvent.contentOffset.y;
              debouncedScrollSave(route.params.pathId, scorllOffset.current);
            }}
            onTouchStart={() => handleStopAutoScroll()}
            scrollEventThrottle={16}
          >
            {pathContent?.page?.map((path: any, index: number) => (
              <SimpleTextForPath
                key={index}
                gurbaniLine={isLarivaar ? path.larivaar.unicode : path.verse.unicode}
                onSelection={() => {
                  if (isSaving) {
                    setPressIndex(index + 1);
                  }
                }}
                onSave={() =>
                  handleUpdatePath(
                    route.params.pathId || 1,
                    pathAng,
                    path.verseId,
                    scorllOffset.current,
                    setIsSaved
                  )
                }
                isSaving={isSaving}
                pressIndex={pressIndex}
                index={index + 1}
                verseId={path.verseId}
                matchedVerseId={matchedVerseId}
                setIsSaving={setIsSaving}
                setIsSaved={setIsSaved}
                setPressIndex={setPressIndex}
              />
            ))}
          </ScrollView>
        </GestureRecognizer>
        {aleartIndicator.current != undefined ? (
          <View style={PathScreenStyles.alertContainer}>
            {aleartIndicator.current}
            <Text style={PathScreenStyles.alertText}>{alertText.current}</Text>
          </View>
        ) : null}

        {!isSaving && !found ? (
          <View style={PathScreenStyles.navigationContainer}>
            <NavContent navIcon={<HomeIcon />} onPress={() => navigation.push('Home')} />
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
            <NavContent navIcon={<SettingsIcon />} onPress={() => navigation.push('Setting')} />
          </View>
        ) : undefined}
        {isSaving && (
          <Animated.View style={{ ...PathScreenStyles.saveContainer, opacity: fadeAnim }}>
            <NavContent navIcon={<SaveIcon />} />
            <Text style={PathScreenStyles.saveText} allowFontScaling={false}>
              {!isSaved ? 'Select a panktee to save progress.' : 'Saved the highlighted panktee!'}
            </Text>
          </Animated.View>
        )}
        {found && (
          <Animated.View style={{ ...PathScreenStyles.saveContainer, opacity: fadeAnim }}>
            <NavContent navIcon={<SaveIcon />} />
            <Text style={PathScreenStyles.saveText} allowFontScaling={false}>
              Last saved panktee founded!
            </Text>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
};
