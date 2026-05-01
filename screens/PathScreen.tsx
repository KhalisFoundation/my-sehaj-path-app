/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
  useDrawerNavigation,
} from '@hooks';
import {
  AngsNavigation,
  Loading,
  PathControls,
  Message,
  PathReader,
  PathNavigation,
  DrawerMenu,
} from '@components';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { ErrorConstants, Constants, Routes, EDGES_ALL_SIDES, PATH_DATA } from '@constants';

type PathScreenProps = NativeStackScreenProps<RootStackParamList, 'Path'>;

export const PathScreen = React.memo(({ navigation, route }: PathScreenProps) => {
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathContent, setPathContent] = useState<any>();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedPathVerseId, setSavedPathVerseId] = useState<number>(0);
  const [savedAngNumber, setSavedAngNumber] = useState<number>(0);
  const [centerVerseId, setCenterVerseId] = useState<number>(0);
  const [pressIndex, setPressIndex] = useState<number>(0);
  const [found, setFound] = useState<boolean>(false);
  const [isLarivaar, setIsLarivaar] = useState<boolean>(false);
  const [isParagraphMode, setIsParagraphMode] = useState<boolean>(false);
  const [isVishraam, setIsVishraam] = useState<boolean>(false);
  const [vishraamsSource, setVishraamsSource] = useState<string>(Constants.DEFAULT_VISHRAAM_SOURCE);
  const [vishraamsStyle] = useState<string>('colored-words');
  const matchedPath = useRef<PathData | undefined>(undefined);
  const matchedPathDate = useRef<DateData | undefined>(undefined);
  const [angsFormat, setAngsFormat] = useState<AngsFormat>({ format: 'Punjabi' });
  const [isAngsNavigationVisible, setIsAngsNavigationVisible] = useState<boolean>(false);
  const [isAngNavigation, setIsAngNavigation] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState<boolean>(false);
  const [retryState, setRetryState] = useState<{
    needsRetry: boolean;
    lastFailedAng: number | null;
  }>({
    needsRetry: false,
    lastFailedAng: null,
  });
  const scrolledToSavedPath = useRef<boolean>(false);
  const scrollOffset = useRef<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const alertIndicator = useRef<React.ReactNode | undefined>(undefined);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | void | null>(null);
  const fadeAnim = useRef(new Animated.Value(1));
  const debounceAnimValueRef = useRef(new Animated.Value(0));
  const [fontSize, setFontSize] = useState<number>(18);
  const [readerContentHeight, setReaderContentHeight] = useState<number>(0);
  const previousFontSize = useRef<number>(18);
  const previousParagraphMode = useRef<boolean>(false);
  const [scrollToVerseId, setScrollToVerseId] = useState<number>(0);
  const [scrollToVerseRequestKey, setScrollToVerseRequestKey] = useState<number>(0);
  const completionUndoPendingRef = useRef<boolean>(false);
  // Baseline scroll Y captured when completion guard starts; used to measure
  // upward movement and undo completion only after user scrolls up > 200px.
  const completionUndoStartScrollYRef = useRef<number | null>(null);

  const resetTransientUiState = useCallback(() => {
    setIsSaving(false);
    setIsSaved(false);
    setPressIndex(0);
    setFound(false);
  }, []);

  const pathPujabiAng = useMemo(
    () =>
      convertNumberToFormat({
        number: pathAng,
        format: angsFormat.format,
      }),
    [pathAng, angsFormat.format]
  );

  const { checkNetwork, isOnline } = useInternet();
  const { handleDrawerNavigate } = useDrawerNavigation();
  const {
    fetchFromLocal,
    handleUpdatePathWithErrorHandling,
    handleUpdatePath,
    clearPathCompletionAndSavedVerse,
    fetchLarivaar,
    fetchFontSize,
    fetchAngsFormat,
    fetchParagraphMode,
    fetchVishraam,
    fetchVishraamsSource,
  } = useLocal();

  useScreenAnalytics('PathScreen', 'PathScreen');

  const fetchFromBaniDB = useCallback(
    async (angNumber: number) => {
      alertIndicator.current = <ActivityIndicator size={'large'} color={'#000'} />;
      setReaderContentHeight(0);
      const pathFromBaniDB = await BaniDB(angNumber);
      alertIndicator.current = undefined;
      setPathContent(pathFromBaniDB.data);
      setRetryState({ needsRetry: false, lastFailedAng: null });
      resetTransientUiState();
      if (pathFromBaniDB.success === false) {
        const isConnected = await checkNetwork();
        if (!isConnected) {
          setRetryState({ needsRetry: true, lastFailedAng: angNumber });
          showErrorAlert(
            ErrorConstants.NO_INTERNET_TITLE + '\n' + ErrorConstants.NO_INTERNET_MESSAGE
          );
        } else {
          navigation.replace(Routes.Error);
          return;
        }
      }
      const currentDebounceTimer = debounceTimer.current;
      if (currentDebounceTimer) {
        clearTimeout(currentDebounceTimer);
        debounceTimer.current = null;
      }
      scrollOffset.current = 0;
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });
    },
    [checkNetwork, navigation, resetTransientUiState]
  );

  const { handleRightArrow, handleLeftArrow } = useNavigation({
    isNavigating,
    setIsNavigating,
    setIsSaving,
    scrollOffset,
    scrollRef,
    setPathAng,
    checkNetwork,
    fetchFromBaniDB,
  });

  const resetCompletionViewState = useCallback(
    (angNumber?: number) => {
      if (matchedPath.current) {
        matchedPath.current.completionDate = '';
        matchedPath.current.saveData = {
          angNumber: angNumber ?? matchedPath.current.saveData.angNumber,
          verseId: 0,
        };
      }
      if (matchedPathDate.current) {
        matchedPathDate.current.scrollPosition = scrollOffset.current;
      }
      setSavedPathVerseId(0);
      setCenterVerseId(0);
      setPressIndex(0);
      setIsSaved(false);
      completionUndoStartScrollYRef.current = null;
    },
    [scrollOffset]
  );

  const undoCompletion = useCallback(
    async (angNumber: number) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      await clearPathCompletionAndSavedVerse(route.params.pathId, scrollOffset.current, angNumber);
      resetCompletionViewState(angNumber);
      completionUndoPendingRef.current = true;
      setSavedAngNumber(angNumber);
    },
    [clearPathCompletionAndSavedVerse, resetCompletionViewState, route.params.pathId]
  );

  const commitSavedPathState = useCallback(
    (
      angNumber: number,
      verseId: number,
      scrollPosition = scrollOffset.current,
      clearAngNavigation = false
    ) => {
      if (!matchedPath.current) {
        return;
      }
      matchedPath.current.saveData = { angNumber, verseId };
      matchedPath.current.completionDate =
        angNumber === PATH_DATA.LAST_ANG_NUMBER && verseId === PATH_DATA.LAST_VERSE_ID
          ? matchedPath.current.completionDate || new Date().toISOString()
          : '';
      setSavedAngNumber(angNumber);
      setSavedPathVerseId(verseId);
      completionUndoPendingRef.current =
        angNumber === PATH_DATA.LAST_ANG_NUMBER && verseId === PATH_DATA.LAST_VERSE_ID;
      if (completionUndoPendingRef.current) {
        completionUndoStartScrollYRef.current = scrollPosition;
      }
      if (matchedPathDate.current) {
        matchedPathDate.current.scrollPosition = scrollPosition;
      }
      if (clearAngNavigation) {
        setIsAngNavigation(false);
      }
    },
    [scrollOffset, setIsAngNavigation]
  );

  const debouncedScrollSave = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceAnimValueRef.current.setValue(0);
    debounceTimer.current = Animated.timing(debounceAnimValueRef.current, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      try {
        if (completionUndoPendingRef.current) {
          const verseIdToKeep = matchedPath.current?.saveData.verseId || savedPathVerseId;
          handleUpdatePath(
            route.params.pathId,
            pathAng,
            verseIdToKeep,
            scrollOffset.current,
            setIsSaved
          );
          return;
        }

        handleUpdatePath(
          route.params.pathId,
          pathAng,
          matchedPath.current?.saveData.verseId || savedPathVerseId,
          scrollOffset.current,
          () => {
            setIsSaved(false);
            commitSavedPathState(
              pathAng,
              matchedPath.current?.saveData.verseId || savedPathVerseId,
              scrollOffset.current
            );
          }
        );
      } catch (error) {
        // Silently handle error to prevent infinite loop in debounced function
        // Error is already handled at the UI level where user initiated the action
      }
    });
  }, [
    handleUpdatePath,
    clearPathCompletionAndSavedVerse,
    route.params.pathId,
    pathAng,
    savedPathVerseId,
    centerVerseId,
    commitSavedPathState,
  ]);

  const handleScrollEnd = useCallback(
    async (scrollY: number) => {
      // Any manual scroll means we're no longer in initial auto-resume mode.
      scrolledToSavedPath.current = true;
      setFound(false);
      if (
        !completionUndoPendingRef.current ||
        pathAng !== PATH_DATA.LAST_ANG_NUMBER ||
        completionUndoStartScrollYRef.current === null
      ) {
        return;
      }

      const upwardDelta = completionUndoStartScrollYRef.current - scrollY;
      if (upwardDelta < 200) {
        return;
      }

      try {
        await undoCompletion(PATH_DATA.LAST_ANG_NUMBER);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
      }
    },
    [pathAng, undoCompletion]
  );

  const { scrollToSavedPathData } = useScrollToSavedPath({
    matchedPathDate: matchedPathDate.current,
    pathContent,
    savedPathVerseId,
    scrolledToSavedPath,
    scrollRef,
    scrollOffset,
    fadeAnim: fadeAnim.current,
    setFound,
    setIsSaving,
    setIsSaved,
    fetchFontSize,
  });

  const updatePathAng = useCallback(
    (angNumber: number) => {
      setPathAng(angNumber);
      resetTransientUiState();
      setSavedAngNumber(angNumber);
      if (angNumber !== PATH_DATA.LAST_ANG_NUMBER) {
        completionUndoPendingRef.current = false;
        completionUndoStartScrollYRef.current = null;
      }
    },
    [resetTransientUiState]
  );

  const persistCurrentScrollPosition = useCallback(async () => {
    if (!pathAng) {
      return;
    }

    try {
      const verseIdToKeep = matchedPath.current?.saveData.verseId || savedPathVerseId;
      await handleUpdatePath(
        route.params.pathId,
        pathAng,
        verseIdToKeep,
        scrollOffset.current,
        () => {}
      );
      commitSavedPathState(pathAng, verseIdToKeep, scrollOffset.current);
    } catch (error) {
      // Leaving the screen should not be blocked by a background scroll-position save.
    }
  }, [
    handleUpdatePath,
    route.params.pathId,
    pathAng,
    savedPathVerseId,
    scrollOffset,
    commitSavedPathState,
  ]);

  const { handleGoBack } = usePathNavigation({
    isAngNavigation,
    pathAng,
    pathId: route.params.pathId,
    setIsAngNavigation,
    updatePathAng,
    navigation,
    persistCurrentScroll: persistCurrentScrollPosition,
  });

  const handlePathDrawerNavigate = useCallback(
    async (targetRoute: string, targetPathId?: number) => {
      await persistCurrentScrollPosition();
      handleDrawerNavigate(targetRoute, targetPathId);
    },
    [persistCurrentScrollPosition, handleDrawerNavigate]
  );

  const handleAngsRightArrow = useCallback(() => {
    handleRightArrow(pathAng);
  }, [handleRightArrow, pathAng]);

  const handleAngsLeftArrow = useCallback(() => {
    handleLeftArrow(pathAng);
  }, [handleLeftArrow, pathAng]);

  const handleReaderContentSizeChange = useCallback((_: number, height: number) => {
    setReaderContentHeight((currentHeight) => (currentHeight === height ? currentHeight : height));
  }, []);

  const savingMessage = useMemo(
    () =>
      !isSaved
        ? Constants.SELECT_A_PANKTEE_TO_SAVE_PROGRESS
        : Constants.SAVED_THE_HIGHLIGHTED_PANKTEE,
    [isSaved]
  );

  useEffect(() => {
    scrolledToSavedPath.current = false;
    const fetchPath = async () => {
      try {
        try {
          const [larivaar, format, paragraphMode, vishraam, vishraamsSourceData, fontSizeData] =
            await Promise.all([
              fetchLarivaar(),
              fetchAngsFormat(),
              fetchParagraphMode(),
              fetchVishraam(),
              fetchVishraamsSource(),
              fetchFontSize(),
            ]);

          const nextParagraphMode = paragraphMode || false;
          const nextFontSize = fontSizeData.number;

          setIsLarivaar(larivaar || false);
          setAngsFormat(format);
          setIsParagraphMode(nextParagraphMode);
          setIsVishraam(vishraam || false);
          setVishraamsSource(vishraamsSourceData?.source || Constants.DEFAULT_VISHRAAM_SOURCE);
          setFontSize(nextFontSize);
          previousFontSize.current = nextFontSize;
          previousParagraphMode.current = nextParagraphMode;
        } catch (error) {
          setIsLarivaar(false);
          setAngsFormat({ format: 'Punjabi' });
          setIsParagraphMode(false);
          setIsVishraam(false);
          setFontSize(18);
          previousFontSize.current = 18;
          previousParagraphMode.current = false;
        }

        const { pathDataArray, pathDateDataArray } = await fetchFromLocal();
        const matchedPathData = pathDataArray.find(
          (path: PathData) => path.pathId === route.params.pathId
        );
        const matchedPathDateData = pathDateDataArray.find(
          (pathDate: DateData) => pathDate.pathid === route.params.pathId
        );
        if (matchedPathData) {
          matchedPath.current = matchedPathData;
          matchedPathDate.current = matchedPathDateData;
          completionUndoPendingRef.current = false;
          completionUndoStartScrollYRef.current = null;
          const pathAngData =
            matchedPathData.saveData.angNumber === 0 ? 1 : matchedPathData.saveData.angNumber;
          setSavedAngNumber(pathAngData);
          setSavedPathVerseId(matchedPathData.saveData.verseId);
          setCenterVerseId(matchedPathData.saveData.verseId);
          setPathAng(pathAngData);

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
    if (!matchedPath.current) {
      return;
    }

    if (pathAng === savedAngNumber) {
      setSavedPathVerseId(matchedPath.current.saveData.verseId);
    } else {
      setSavedPathVerseId(0);
    }
  }, [pathAng, savedAngNumber]);

  useEffect(() => {
    const clearCompletionAfterLeavingLastAng = async () => {
      if (!matchedPath.current) {
        return;
      }

      if (pathAng === PATH_DATA.LAST_ANG_NUMBER) {
        return;
      }

      completionUndoPendingRef.current = false;
      completionUndoStartScrollYRef.current = null;

      if (matchedPath.current.completionDate === '') {
        return;
      }

      try {
        await clearPathCompletionAndSavedVerse(route.params.pathId, scrollOffset.current);
        resetCompletionViewState();
        completionUndoPendingRef.current = false;
        completionUndoStartScrollYRef.current = null;
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
      }
    };

    clearCompletionAfterLeavingLastAng();
  }, [pathAng, resetCompletionViewState]);

  useEffect(() => {
    if (isSaved || found) {
      fadeAnim.current.setValue(1);
      Animated.timing(fadeAnim.current, {
        toValue: 0,
        duration: 2500,
        useNativeDriver: true,
      }).start(() => {
        Promise.resolve().then(() => {
          setIsSaved(false);
          setIsSaving(false);
          Animated.timing(new Animated.Value(0), {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start(() => {
            Promise.resolve().then(() => {
              setFound(false);
            });
          });
        });
      });
    }
    return () => {
      fadeAnim.current.stopAnimation();
    };
  }, [isSaved, found]);

  useEffect(() => {
    const savedScrollPosition = matchedPathDate.current?.scrollPosition || 0;
    const isSavedAng = pathAng === matchedPath.current?.saveData.angNumber;
    const hasEnoughContentForSavedScroll =
      savedScrollPosition === 0 || readerContentHeight > savedScrollPosition;

    if (!isSavedAng || !pathContent || !hasEnoughContentForSavedScroll) {
      return;
    }

    let firstFrame: number | null = null;
    let secondFrame: number | null = null;

    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        scrollToSavedPathData();
      });
    });

    return () => {
      if (firstFrame !== null) {
        cancelAnimationFrame(firstFrame);
      }
      if (secondFrame !== null) {
        cancelAnimationFrame(secondFrame);
      }
    };
  }, [pathAng, pathContent, readerContentHeight, scrollToSavedPathData]);

  useFocusEffect(
    useCallback(() => {
      const refreshDisplaySettings = async () => {
        try {
          const [larivaar, format, paragraphMode, vishraam, vishraamsSourceData, fontSizeData] =
            await Promise.all([
              fetchLarivaar(),
              fetchAngsFormat(),
              fetchParagraphMode(),
              fetchVishraam(),
              fetchVishraamsSource(),
              fetchFontSize(),
            ]);

          setIsLarivaar(larivaar || false);
          setAngsFormat(format);
          setIsParagraphMode(paragraphMode || false);
          setIsVishraam(vishraam || false);
          setVishraamsSource(vishraamsSourceData?.source || Constants.DEFAULT_VISHRAAM_SOURCE);
          setFontSize(fontSizeData.number);
        } catch (error) {
          setIsLarivaar(false);
          setAngsFormat({ format: 'Punjabi' });
          setIsParagraphMode(false);
          setIsVishraam(false);
          setFontSize(18);
        }
      };

      refreshDisplaySettings();
    }, [])
  );

  // Maintain scroll position when font size or paragraph mode changes
  useEffect(() => {
    const fontSizeChanged = fontSize !== previousFontSize.current;
    const paragraphModeChanged = isParagraphMode !== previousParagraphMode.current;
    const verseIdToCenter =
      centerVerseId || savedPathVerseId || matchedPath.current?.saveData.verseId || 0;

    if (
      (fontSizeChanged || paragraphModeChanged) &&
      verseIdToCenter !== 0 &&
      pathContent?.page?.some((page: any) => page.verseId === verseIdToCenter)
    ) {
      previousFontSize.current = fontSize;
      previousParagraphMode.current = isParagraphMode;
      setScrollToVerseId(verseIdToCenter);
      setScrollToVerseRequestKey((currentKey) => currentKey + 1);
    }
  }, [fontSize, isParagraphMode, pathContent, centerVerseId, savedPathVerseId]);
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

      fadeAnim.current.stopAnimation();
    };
  }, []);

  useEffect(() => {
    if (isOnline && retryState.needsRetry && retryState.lastFailedAng !== null) {
      setRetryState({ needsRetry: false, lastFailedAng: null });
      // Ensure states are reset before retry to prevent blocking interactions
      setIsSaving(false);
      setIsSaved(false);
      fadeAnim.current.stopAnimation();
      fadeAnim.current.setValue(0);
      fetchFromBaniDB(retryState.lastFailedAng);
    }
  }, [isOnline, retryState, fetchFromBaniDB]);

  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <View style={PathScreenStyles.container}>
        <View>
          <PathNavigation
            pathPujabiAng={pathPujabiAng}
            pathAng={pathAng}
            handleLeftArrow={handleLeftArrow}
            handleRightArrow={handleRightArrow}
            setIsAngsNavigationVisible={setIsAngsNavigationVisible}
            onMenuPress={() => setIsDrawerVisible(true)}
          />
        </View>
        <PathReader
          pathContent={pathContent}
          isLarivaar={isLarivaar}
          isParagraphMode={isParagraphMode}
          isSaving={isSaving}
          pressIndex={pressIndex}
          savedPathVerseId={savedPathVerseId}
          scrollRef={scrollRef}
          scrollOffset={scrollOffset}
          isAngNavigation={isAngNavigation}
          debouncedScrollSave={debouncedScrollSave}
          handleRightArrow={handleRightArrow}
          handleLeftArrow={handleLeftArrow}
          setPressIndex={setPressIndex}
          setSavedPathVerseId={setSavedPathVerseId}
          handleUpdatePathWithErrorHandling={handleUpdatePathWithErrorHandling}
          setIsSaving={setIsSaving}
          setIsSaved={setIsSaved}
          pathId={route.params.pathId}
          isNavigating={isNavigating}
          found={found}
          setFound={setFound}
          fontSize={fontSize}
          isSaved={isSaved}
          isVishraam={isVishraam}
          vishraamsSource={vishraamsSource}
          vishraamsStyle={vishraamsStyle}
          onSaveCommit={commitSavedPathState}
          setCenterVerseId={setCenterVerseId}
          scrollToVerseId={scrollToVerseId}
          scrollToVerseRequestKey={scrollToVerseRequestKey}
          scrolledToSavedPath={scrolledToSavedPath}
          onScrollEndDrag={handleScrollEnd}
          onContentSizeChange={handleReaderContentSizeChange}
        />
        {alertIndicator.current !== undefined ? (
          <Loading
            alertIndicator={alertIndicator.current}
            alertText={Constants.ALERT_TEXT_LOADING}
          />
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
        {isSaving && <Message message={savingMessage} fadeAnim={fadeAnim.current} />}
        {found && (
          <Message message={Constants.RESUMING_SAVED_PROGRESS} fadeAnim={fadeAnim.current} />
        )}
        {isAngsNavigationVisible && (
          <AngsNavigation
            setIsAngsNavigationVisible={setIsAngsNavigationVisible}
            handleRightArrow={handleAngsRightArrow}
            handleLeftArrow={handleAngsLeftArrow}
            pathAng={pathAng}
            isAngNavigation={isAngNavigation}
            setIsAngNavigation={setIsAngNavigation}
            fetchAngData={fetchFromBaniDB}
            updatePathAng={updatePathAng}
          />
        )}
        <DrawerMenu
          isVisible={isDrawerVisible}
          onClose={() => setIsDrawerVisible(false)}
          onNavigate={handlePathDrawerNavigate}
          currentRoute={Routes.Path}
          pathId={route.params.pathId}
          onGoToAngPress={() => setIsAngsNavigationVisible(true)}
          onSavePress={() => {
            setIsSaving(true);
            fadeAnim.current.setValue(1);
          }}
        />
      </View>
    </SafeAreaView>
  );
});
