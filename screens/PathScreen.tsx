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
  const previousFontSize = useRef<number>(18);
  const previousParagraphMode = useRef<boolean>(false);
  const [scrollToVerseId, setScrollToVerseId] = useState<number>(0);
  const isDebounceSaveEnabledRef = useRef<boolean>(true);
  // Baseline scroll Y captured when completion guard starts; used to measure
  // upward movement and undo completion only after user scrolls up > 200px.
  const completionUndoStartScrollYRef = useRef<number | null>(null);

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
    updatePathScrollPosition,
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
      const pathFromBaniDB = await BaniDB(angNumber);
      setPathContent(pathFromBaniDB.data);
      setRetryState({ needsRetry: false, lastFailedAng: null });
      setIsSaving(false);
      setIsSaved(false);
      setPressIndex(0);
      setFound(false);
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
      alertIndicator.current = undefined;
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
    [checkNetwork, navigation]
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

  const undoCompletion = useCallback(
    async (angNumber: number) => {
      await clearPathCompletionAndSavedVerse(route.params.pathId, scrollOffset.current, angNumber);
      if (matchedPath.current) {
        matchedPath.current.completionDate = '';
        matchedPath.current.saveData = {
          angNumber,
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
      isDebounceSaveEnabledRef.current = true;
      completionUndoStartScrollYRef.current = null;
    },
    [clearPathCompletionAndSavedVerse, route.params.pathId]
  );

  const isCompletedAtFinalCheckpoint = useCallback(() => {
    return (
      matchedPath.current?.completionDate !== '' &&
      matchedPath.current?.saveData.angNumber === PATH_DATA.LAST_ANG_NUMBER &&
      matchedPath.current?.saveData.verseId === PATH_DATA.LAST_VERSE_ID
    );
  }, []);

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
        // Freeze autosave immediately after completion so small scroll jitter does not undo it.
        if (!isDebounceSaveEnabledRef.current) {
          return;
        }

        // Use savedPathVerseId if manually selected (long-press), otherwise use centerVerseId
        // If both are 0, don't save (no verse has been identified yet)
        const verseIdToSave = savedPathVerseId !== 0 ? savedPathVerseId : centerVerseId;

        // After undoing completion, ignore stale callback that still tries to save
        // the final verse immediately from previous closure/frame state.
        const isStaleFinalVerseReplay =
          matchedPath.current?.completionDate === '' &&
          matchedPath.current?.saveData.angNumber === PATH_DATA.LAST_ANG_NUMBER &&
          matchedPath.current?.saveData.verseId === 0 &&
          pathAng === PATH_DATA.LAST_ANG_NUMBER &&
          verseIdToSave === PATH_DATA.LAST_VERSE_ID;
        if (isStaleFinalVerseReplay) {
          return;
        }

        if (verseIdToSave === 0) {
          updatePathScrollPosition(route.params.pathId, scrollOffset.current);
          if (matchedPathDate.current) {
            matchedPathDate.current.scrollPosition = scrollOffset.current;
          }
          return;
        }

        handleUpdatePath(route.params.pathId, pathAng, verseIdToSave, scrollOffset.current, () => {
          setIsSaved(false);
          if (matchedPath.current) {
            matchedPath.current.saveData = { angNumber: pathAng, verseId: verseIdToSave };
            const isCompletedNow =
              pathAng === PATH_DATA.LAST_ANG_NUMBER && verseIdToSave === PATH_DATA.LAST_VERSE_ID;
            matchedPath.current.completionDate = isCompletedNow
              ? matchedPath.current.completionDate || new Date().toISOString()
              : '';

            if (isCompletedNow) {
              // Start a guarded window where only deliberate upward scroll can undo completion.
              isDebounceSaveEnabledRef.current = false;
              completionUndoStartScrollYRef.current = scrollOffset.current;
            }
          }
        });
      } catch (error) {
        // Silently handle error to prevent infinite loop in debounced function
        // Error is already handled at the UI level where user initiated the action
      }
    });
  }, [
    handleUpdatePath,
    updatePathScrollPosition,
    route.params.pathId,
    pathAng,
    savedPathVerseId,
    centerVerseId,
  ]);

  const handleUpwardScroll = useCallback(
    async (scrollY: number) => {
      // Any manual scroll means we're no longer in initial auto-resume mode.
      scrolledToSavedPath.current = true;
      setFound(false);
      const completedByHomeRule = isCompletedAtFinalCheckpoint();
      // Direction handler is only relevant while completion is in guarded pause mode.
      if (isDebounceSaveEnabledRef.current) {
        return;
      }
      if (!completedByHomeRule) {
        isDebounceSaveEnabledRef.current = true;
        completionUndoStartScrollYRef.current = null;
        return;
      }

      // On final ang: require deliberate upward movement before undo.
      if (pathAng !== PATH_DATA.LAST_ANG_NUMBER) {
        return;
      }

      if (completionUndoStartScrollYRef.current === null) {
        completionUndoStartScrollYRef.current = scrollY;
      }

      const upwardDelta = completionUndoStartScrollYRef.current - scrollY;
      if (upwardDelta < 200) {
        return;
      }

      try {
        await undoCompletion(pathAng);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
      }
    },
    [pathAng, undoCompletion, isCompletedAtFinalCheckpoint]
  );

  const handleAnyScroll = useCallback(() => {
    // Any manual scroll means we're no longer in initial auto-resume mode.
    scrolledToSavedPath.current = true;
    setFound(false);
  }, []);

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

  const updatePathAng = useCallback((angNumber: number) => {
    setPathAng(angNumber);
    setIsSaving(false);
    setIsSaved(false);
    setPressIndex(0);
    setFound(false);
  }, []);

  const { handleGoBack } = usePathNavigation({
    isAngNavigation,
    pathAng,
    savedPathVerseId,
    pathId: route.params.pathId,
    setIsSaved,
    setIsAngNavigation,
    updatePathAng,
    scrollOffset,
    navigation,
  });
  const handleAngsRightArrow = useCallback(() => {
    handleRightArrow(pathAng);
  }, [handleRightArrow, pathAng]);

  const handleAngsLeftArrow = useCallback(() => {
    handleLeftArrow(pathAng);
  }, [handleLeftArrow, pathAng]);

  const savingMessage = useMemo(
    () =>
      !isSaved
        ? Constants.SELECT_A_PANKTEE_TO_SAVE_PROGRESS
        : Constants.SAVED_THE_HIGHLIGHTED_PANKTEE,
    [isSaved]
  );

  // Manual save path (via long-press save) does not always pass through debounced save callback.
  // Arm pause/anchor here too so undo-on-scroll remains reliable after completing last line.
  useEffect(() => {
    const completedNow =
      isSaved &&
      pathAng === PATH_DATA.LAST_ANG_NUMBER &&
      savedPathVerseId === PATH_DATA.LAST_VERSE_ID;

    if (completedNow) {
      // Manual save can bypass debounced autosave callback; arm completion guard here as well.
      isDebounceSaveEnabledRef.current = false;
      completionUndoStartScrollYRef.current = scrollOffset.current;
      if (matchedPath.current) {
        matchedPath.current.saveData = {
          angNumber: PATH_DATA.LAST_ANG_NUMBER,
          verseId: PATH_DATA.LAST_VERSE_ID,
        };
        matchedPath.current.completionDate =
          matchedPath.current.completionDate || new Date().toISOString();
      }
    } else if (isSaved && savedPathVerseId !== 0) {
      // Any explicit successful save of a verse re-enables normal debounced autosave.
      isDebounceSaveEnabledRef.current = true;
      completionUndoStartScrollYRef.current = null;
    }
  }, [isSaved, pathAng, savedPathVerseId]);

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
          matchedPath.current = matchedPathData;
          matchedPathDate.current = matchedPathDateData;
          isDebounceSaveEnabledRef.current = true;
          completionUndoStartScrollYRef.current = null;
          const pathAngData =
            matchedPathData.saveData.angNumber === 0 ? 1 : matchedPathData.saveData.angNumber;
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

  // Clear savedPathVerseId when navigating to a different ang than the saved ang
  // This prevents showing old saved verseId from a different ang
  useEffect(() => {
    if (matchedPath.current && pathAng !== matchedPath.current.saveData.angNumber) {
      // User navigated to a different ang - clear the saved verseId
      // It will only be set again if user explicitly saves a line on this ang
      setSavedPathVerseId(0);
    } else if (matchedPath.current && pathAng === matchedPath.current.saveData.angNumber) {
      // User is on the saved ang - restore the saved verseId
      setSavedPathVerseId(matchedPath.current.saveData.verseId);
    }
  }, [pathAng]);

  useEffect(() => {
    const clearCompletionAfterLeavingLastAng = async () => {
      if (!matchedPath.current) {
        return;
      }

      const hasCompletionMarked = matchedPath.current.completionDate !== '';
      if (pathAng === PATH_DATA.LAST_ANG_NUMBER || !hasCompletionMarked) {
        return;
      }

      try {
        await undoCompletion(pathAng);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PATH_PROGRESS);
      }
    };

    clearCompletionAfterLeavingLastAng();
  }, [pathAng, undoCompletion]);

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

  const scrollAnimValueRef = useRef(new Animated.Value(0));

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (pathAng === matchedPath.current?.saveData.angNumber && pathContent) {
      scrollAnimValueRef.current.setValue(0);
      animation = Animated.timing(scrollAnimValueRef.current, {
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
  }, [pathAng, pathContent, scrollToSavedPathData]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          const [larivaar, format, paragraphMode, vishraam, vishraamsSourceData] =
            await Promise.all([
              fetchLarivaar(),
              fetchAngsFormat(),
              fetchParagraphMode(),
              fetchVishraam(),
              fetchVishraamsSource(),
            ]);
          setIsLarivaar(larivaar || false);
          setAngsFormat(format);
          setIsParagraphMode(paragraphMode || false);
          setIsVishraam(vishraam || false);
          setVishraamsSource(vishraamsSourceData?.source || Constants.DEFAULT_VISHRAAM_SOURCE);
        } catch (error) {
          setIsLarivaar(false);
          setAngsFormat({ format: 'Punjabi' });
          setIsParagraphMode(false);
          setIsVishraam(false);
        }
      };
      fetchData();
    }, [
      fetchLarivaar,
      fetchAngsFormat,
      fetchParagraphMode,
      fetchVishraam,
      fetchVishraamsSource,
      pathAng,
    ])
  );
  useFocusEffect(
    useCallback(() => {
      const fetch = async () => {
        try {
          const fontSizeData = await fetchFontSize();
          setFontSize(fontSizeData.number);
        } catch (e) {
          showErrorAlert(ErrorConstants.FAILED_TO_LOAD_FONT_SIZE);
          setFontSize(18);
        }
      };
      fetch();
    }, [fetchFontSize])
  );

  // Maintain scroll position when font size or paragraph mode changes
  useEffect(() => {
    const fontSizeChanged = fontSize !== previousFontSize.current;
    const paragraphModeChanged = isParagraphMode !== previousParagraphMode.current;

    if ((fontSizeChanged || paragraphModeChanged) && pathContent?.page && centerVerseId !== 0) {
      previousFontSize.current = fontSize;
      previousParagraphMode.current = isParagraphMode;

      // Calculate the verse index to know how much content is above
      const verseIndex = pathContent.page.findIndex((page: any) => page.verseId === centerVerseId);

      if (verseIndex !== -1 && scrollRef.current) {
        // Wait for layout to complete with new font size, then scroll to the verse
        setTimeout(() => {
          setScrollToVerseId(centerVerseId);
        }, 200);
      }
    }
  }, [fontSize, isParagraphMode, pathContent, centerVerseId]);
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
          setIsAngNavigation={setIsAngNavigation}
          isVishraam={isVishraam}
          vishraamsSource={vishraamsSource}
          vishraamsStyle={vishraamsStyle}
          setCenterVerseId={setCenterVerseId}
          scrollToVerseId={scrollToVerseId}
          onAnyScroll={handleAnyScroll}
          onUpwardScroll={handleUpwardScroll}
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
          onNavigate={handleDrawerNavigate}
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
