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
  const completionUndoArmed = useRef<boolean>(false);
  const lastScrollYRef = useRef<number>(0);
  const completionSavedScrollYRef = useRef<number>(0);
  // Prevents scroll auto-save from re-completing the path after undo.
  const suppressAutoSaveOnLastAng = useRef<boolean>(false);
  // After undoing completion, block auto-save until user explicitly saves a line.
  const suppressAutoSaveUntilExplicitSave = useRef<boolean>(false);

  const pathPujabiAng = useMemo(
    () =>
      convertNumberToFormat({
        number: pathAng,
        format: angsFormat.format,
      }),
    [pathAng, angsFormat.format]
  );
  const effectiveSavedPathVerseId =
    matchedPath.current && pathAng === matchedPath.current.saveData.angNumber
      ? savedPathVerseId
      : 0;

  const { checkNetwork, isOnline } = useInternet();
  const { handleDrawerNavigate } = useDrawerNavigation();
  const {
    fetchFromLocal,
    handleUpdatePathWithErrorHandling,
    handleUpdatePath,
    updateScrollPositionOnly,
    clearCompletionDate,
    fetchLarivaar,
    fetchFontSize,
    fetchAngsFormat,
    fetchParagraphMode,
  } = useLocal();

  const updateScrollPositionOnlyAndSync = useCallback(
    async (pathId: number, scrollPosition: number) => {
      // Keep resume position without touching saved verse state.
      const updated = await updateScrollPositionOnly(pathId, scrollPosition);
      if (updated && matchedPathDate.current) {
        matchedPathDate.current = {
          ...matchedPathDate.current,
          scrollPosition,
        };
      }
    },
    [updateScrollPositionOnly]
  );

  const clearCompletionDateAndSync = useCallback(
    async (pathId: number) => {
      // Undo completion without changing the saved verse.
      const updated = await clearCompletionDate(pathId);
      if (updated && matchedPath.current) {
        matchedPath.current = {
          ...matchedPath.current,
          completionDate: '',
        };
      }
    },
    [clearCompletionDate]
  );

  const syncMatchedPathRefs = useCallback(
    (angNumber: number, verseId: number, scrollPosition: number) => {
      if (matchedPath.current) {
        matchedPath.current = {
          ...matchedPath.current,
          saveData: { angNumber, verseId },
        };
      }
      if (matchedPathDate.current) {
        matchedPathDate.current = {
          ...matchedPathDate.current,
          scrollPosition,
        };
      }
      completionUndoArmed.current =
        angNumber === PATH_DATA.LAST_ANG_NUMBER && verseId === PATH_DATA.LAST_VERSE_ID;
      if (completionUndoArmed.current) {
        completionSavedScrollYRef.current = scrollPosition;
      }
    },
    []
  );

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
        // Only persist an explicitly saved verse; scrolling should not create a saved line.
        const verseIdToSave = savedPathVerseId !== 0 ? savedPathVerseId : 0;
        const hasAngChanged =
          matchedPath.current && pathAng !== matchedPath.current.saveData.angNumber;

        if (verseIdToSave !== 0 || hasAngChanged) {
          // Update saved verse only when user explicitly saved or ang changed.
          syncMatchedPathRefs(pathAng, verseIdToSave, scrollOffset.current);
          scrolledToSavedPath.current = true;
          handleUpdatePath(
            route.params.pathId,
            pathAng,
            verseIdToSave,
            scrollOffset.current,
            () => {
              setIsSaved(false);
            }
          );
        } else {
          // Save scroll position for resume without modifying saved verse.
          updateScrollPositionOnlyAndSync(route.params.pathId, scrollOffset.current);
        }
      } catch (error) {
        // Silently handle error to prevent infinite loop in debounced function
        // Error is already handled at the UI level where user initiated the action
      }
    });
  }, [handleUpdatePath, route.params.pathId, pathAng, savedPathVerseId]);

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

  const handleUserScroll = useCallback(
    (scrollY: number, _centerVerseIdFromScroll: number) => {
      if (suppressAutoSaveUntilExplicitSave.current) {
        // After undo, keep updating scroll position but block auto-save.
        if (Math.abs(scrollY - lastScrollYRef.current) > 20) {
          lastScrollYRef.current = scrollY;
          updateScrollPositionOnlyAndSync(route.params.pathId, scrollY);
        }
        return true;
      }
      if (suppressAutoSaveOnLastAng.current && pathAng === PATH_DATA.LAST_ANG_NUMBER) {
        // Avoid re-completing on last ang while completion is undone.
        return true;
      }
      if (
        completionUndoArmed.current &&
        pathAng === PATH_DATA.LAST_ANG_NUMBER &&
        matchedPath.current?.saveData.verseId === PATH_DATA.LAST_VERSE_ID
      ) {
        // Any scroll after completing last line should undo completion.
        lastScrollYRef.current = scrollY;
        suppressAutoSaveOnLastAng.current = true;
        suppressAutoSaveUntilExplicitSave.current = true;
        completionUndoArmed.current = false;
        scrolledToSavedPath.current = true;
        clearCompletionDateAndSync(route.params.pathId);
        updateScrollPositionOnlyAndSync(route.params.pathId, scrollY);
        setIsSaving(false);
        setIsSaved(false);
        setPressIndex(0);
        return true;
      }
      return false;
    },
    [clearCompletionDateAndSync, pathAng, route.params.pathId, updateScrollPositionOnlyAndSync]
  );

  const handleUpdatePathWithSync = useCallback(
    (
      pathId: number,
      pageNo: number,
      verseId: number,
      scrollPosition: number,
      setIsSavedValue: (value: boolean) => void
    ) => {
      handleUpdatePathWithErrorHandling(
        pathId,
        pageNo,
        verseId,
        scrollPosition,
        (value: boolean) => {
          if (value) {
            suppressAutoSaveUntilExplicitSave.current = false;
            suppressAutoSaveOnLastAng.current = false;
            syncMatchedPathRefs(pageNo, verseId, scrollPosition);
            scrolledToSavedPath.current = true;
          }
          setIsSavedValue(value);
        }
      );
    },
    [handleUpdatePathWithErrorHandling, syncMatchedPathRefs]
  );

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
      setIsSaving(false);
      setIsSaved(false);
      setPressIndex(0);
    } else if (matchedPath.current && pathAng === matchedPath.current.saveData.angNumber) {
      // User is on the saved ang - restore the saved verseId
      setSavedPathVerseId(matchedPath.current.saveData.verseId);
    }
    if (matchedPath.current) {
      suppressAutoSaveOnLastAng.current =
        pathAng === PATH_DATA.LAST_ANG_NUMBER &&
        matchedPath.current.completionDate === '' &&
        matchedPath.current.saveData.verseId === PATH_DATA.LAST_VERSE_ID;
    }
    if (pathAng !== PATH_DATA.LAST_ANG_NUMBER) {
      suppressAutoSaveUntilExplicitSave.current = false;
      suppressAutoSaveOnLastAng.current = false;
    }
  }, [pathAng]);

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
          const [larivaar, format, paragraphMode] = await Promise.all([
            fetchLarivaar(),
            fetchAngsFormat(),
            fetchParagraphMode(),
          ]);
          setIsLarivaar(larivaar || false);
          setAngsFormat(format);
          setIsParagraphMode(paragraphMode || false);
        } catch (error) {
          setIsLarivaar(false);
          setAngsFormat({ format: 'Punjabi' });
          setIsParagraphMode(false);
        }
      };
      fetchData();
    }, [fetchLarivaar, fetchAngsFormat, fetchParagraphMode, pathAng])
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
          savedPathVerseId={effectiveSavedPathVerseId}
          scrollRef={scrollRef}
          scrollOffset={scrollOffset}
          isAngNavigation={isAngNavigation}
          debouncedScrollSave={debouncedScrollSave}
          handleRightArrow={handleRightArrow}
          handleLeftArrow={handleLeftArrow}
          setPressIndex={setPressIndex}
          setSavedPathVerseId={setSavedPathVerseId}
          handleUpdatePathWithErrorHandling={handleUpdatePathWithSync}
          setIsSaving={setIsSaving}
          setIsSaved={setIsSaved}
          pathId={route.params.pathId}
          isNavigating={isNavigating}
          found={found}
          setFound={setFound}
          fontSize={fontSize}
          isSaved={isSaved}
          setIsAngNavigation={setIsAngNavigation}
          setCenterVerseId={setCenterVerseId}
          scrollToVerseId={scrollToVerseId}
          onUserScroll={handleUserScroll}
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
