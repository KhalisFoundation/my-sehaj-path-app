/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, ScrollView, ActivityIndicator, Animated, BackHandler } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BaniDB,
  showErrorAlert,
  showLeaveAnywayAlert,
  convertNumberToFormat,
  recordError,
} from '@utils';
import { PathScreenStyles, SafeAreaStyle } from '@styles';
import {
  DateData,
  PathData,
  useInternet,
  useNavigation,
  usePathNavigation,
  useScrollToSavedPath,
  useDrawerNavigation,
} from '@hooks';
import { store } from '../store';
import { useAppSelector } from '../store/hooks';
import { savePathProgress, undoPathCompletion } from '../store/commands';
import {
  AngsNavigation,
  Loading,
  PathControls,
  Message,
  PathReader,
  PathNavigation,
  DrawerMenu,
  PathSelectionProvider,
} from '@components';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { ErrorConstants, Constants, Routes, EDGES_ALL_SIDES, PATH_DATA } from '@constants';

type PathScreenProps = NativeStackScreenProps<RootStackParamList, 'Path'>;

export const getPathSavingMessage = (
  isSaved: boolean,
  hasPendingVerseSelection: boolean
): string => {
  if (isSaved) {
    return Constants.SAVED_THE_HIGHLIGHTED_PANKTEE;
  }
  return hasPendingVerseSelection
    ? Constants.SAVING_THE_HIGHLIGHTED_PANKTEE
    : Constants.SELECT_A_PANKTEE_TO_SAVE_PROGRESS;
};

export const getDurableSavedVerseId = (
  saveData: { angNumber: number; verseId: number } | undefined,
  displayedAng: number
): number => (saveData?.angNumber === displayedAng ? saveData.verseId : 0);

export const PathScreen = React.memo(({ navigation, route }: PathScreenProps) => {
  const [pathAng, setPathAng] = useState<number>(0);
  const [pathContent, setPathContent] = useState<any>();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [savedPathVerseId, setSavedPathVerseId] = useState<number>(0);
  const [savedAngNumber, setSavedAngNumber] = useState<number>(0);
  const [centerVerseId, setCenterVerseId] = useState<number>(0);
  const [pressIndex, setPressIndex] = useState<number>(0);
  const [hasPendingVerseSelection, setHasPendingVerseSelection] = useState<boolean>(false);
  const [found, setFound] = useState<boolean>(false);
  // Settings are reactive from the store: no fetch-on-focus, and a change in the
  // Settings screen is reflected here immediately. PathReader reads the display
  // settings itself, so only the ones this screen actually uses are selected here.
  const isParagraphMode = useAppSelector((state) => state.settings.paragraphMode);
  const angsFormat = useAppSelector((state) => state.settings.angsFormat);
  const fontSize = useAppSelector((state) => state.settings.fontSize.number);
  const matchedPath = useRef<PathData | undefined>(undefined);
  const matchedPathDate = useRef<DateData | undefined>(undefined);
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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1));
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
    setHasPendingVerseSelection(false);
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

  const { checkNetwork } = useInternet();
  const isOnline = useAppSelector((state) => state.network.isOnline);
  const { handleDrawerNavigate } = useDrawerNavigation();

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
      if (currentDebounceTimer !== null) {
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
      setHasPendingVerseSelection(false);
      setIsSaved(false);
      completionUndoStartScrollYRef.current = null;
    },
    [scrollOffset]
  );

  const undoCompletion = useCallback(
    async (angNumber: number) => {
      if (debounceTimer.current !== null) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      const undone = await undoPathCompletion(route.params.pathId, angNumber, scrollOffset.current);
      if (!undone) {
        // The store rolled itself back to the completed state; do not reset the
        // local completion view to match a change that was not saved.
        // undoPathCompletion already alerted the user.
        return;
      }
      resetCompletionViewState(angNumber);
      completionUndoPendingRef.current = true;
      setSavedAngNumber(angNumber);
    },
    [resetCompletionViewState, route.params.pathId]
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

  const restoreDurableSaveHighlight = useCallback(
    (angNumber: number) => {
      const durablePath = store
        .getState()
        .paths.paths.find((path) => path.pathId === route.params.pathId);
      setSavedPathVerseId(getDurableSavedVerseId(durablePath?.saveData, angNumber));
    },
    [route.params.pathId]
  );

  const debouncedScrollSave = useCallback(() => {
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(async () => {
      debounceTimer.current = null;
      try {
        const verseIdToKeep = matchedPath.current?.saveData.verseId || savedPathVerseId;
        const wasUndoPending = completionUndoPendingRef.current;

        // Background auto-save: silent so a transient failure while scrolling
        // does not spam alerts. Explicit saves (long-press / save icon) alert.
        const saved = await savePathProgress(
          route.params.pathId,
          pathAng,
          verseIdToKeep,
          scrollOffset.current,
          { silent: true }
        );
        if (!saved) {
          return;
        }

        if (wasUndoPending) {
          setIsSaved(true);
          return;
        }
        setIsSaved(false);
        commitSavedPathState(pathAng, verseIdToKeep, scrollOffset.current);
      } catch {
        // Background auto-save remains silent; the command records the failure.
      }
    }, 200);
  }, [route.params.pathId, pathAng, savedPathVerseId, commitSavedPathState]);

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
    fontSize,
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

  // Returns whether the current position is durably saved. Callers that are
  // leaving the screen use this to avoid silently losing the reading position.
  const persistCurrentScrollPosition = useCallback(async (): Promise<boolean> => {
    if (!pathAng) {
      return true; // nothing to save
    }

    try {
      const verseIdToKeep = matchedPath.current?.saveData.verseId || savedPathVerseId;
      // Silent: the navigation handler shows the richer "leave anyway?" choice,
      // so the command must not also pop a plain error alert.
      const saved = await savePathProgress(
        route.params.pathId,
        pathAng,
        verseIdToKeep,
        scrollOffset.current,
        { silent: true }
      );
      // Only mirror the save into local refs when it actually reached disk.
      if (saved) {
        commitSavedPathState(pathAng, verseIdToKeep, scrollOffset.current);
      }
      return saved;
    } catch (error) {
      return false;
    }
  }, [route.params.pathId, pathAng, savedPathVerseId, scrollOffset, commitSavedPathState]);

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
      const saved = await persistCurrentScrollPosition();
      if (!saved) {
        // Never trap the user: offer retry (stay) or leave anyway.
        showLeaveAnywayAlert({
          onLeaveAnyway: () => handleDrawerNavigate(targetRoute, targetPathId),
        });
        return;
      }
      handleDrawerNavigate(targetRoute, targetPathId);
    },
    [persistCurrentScrollPosition, handleDrawerNavigate]
  );

  const handleOpenSettings = useCallback(() => {
    navigation.push(Routes.Setting);
  }, [navigation]);

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
    () => getPathSavingMessage(isSaved, hasPendingVerseSelection),
    [isSaved, hasPendingVerseSelection]
  );

  useEffect(() => {
    scrolledToSavedPath.current = false;
    const fetchPath = async () => {
      try {
        // Settings already live in the store and are applied before this screen
        // renders, so there is no pre-load step here any more. The first scroll
        // restore therefore always runs against the final layout.
        previousFontSize.current = fontSize;
        previousParagraphMode.current = isParagraphMode;

        const { paths, dates } = store.getState().paths;
        const matchedPathData = paths.find((path: PathData) => path.pathId === route.params.pathId);
        const matchedPathDateData = dates.find(
          (pathDate: DateData) => pathDate.pathid === route.params.pathId
        );
        if (matchedPathData) {
          // Deep-copy: store objects are frozen by Immer, and this screen mutates
          // these refs in place. Persisting happens through dispatches instead.
          matchedPath.current = {
            ...matchedPathData,
            saveData: { ...matchedPathData.saveData },
          };
          matchedPathDate.current = matchedPathDateData
            ? { ...matchedPathDateData, dates: [...matchedPathDateData.dates] }
            : undefined;
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
        recordError(error, 'PathScreen: failed to load path data');
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

      const cleared = await undoPathCompletion(
        route.params.pathId,
        undefined,
        scrollOffset.current
      );
      if (!cleared) {
        // undoPathCompletion already alerted the user.
        return;
      }
      resetCompletionViewState();
      completionUndoPendingRef.current = false;
      completionUndoStartScrollYRef.current = null;
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

  // Display settings come straight from the store, so there is no refresh-on-focus
  // step: a change in the Settings screen is already reflected here.

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
      if (debounceTimer.current !== null) {
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
        <PathSelectionProvider
          isSaving={isSaving}
          isSaved={isSaved}
          pressIndex={pressIndex}
          savedPathVerseId={savedPathVerseId}
          hasPendingVerseSelection={hasPendingVerseSelection}
          found={found}
          setIsSaving={setIsSaving}
          setIsSaved={setIsSaved}
          setPressIndex={setPressIndex}
          setSavedPathVerseId={setSavedPathVerseId}
          setHasPendingVerseSelection={setHasPendingVerseSelection}
          setFound={setFound}
        >
          <PathReader
            pathContent={pathContent}
            scrollRef={scrollRef}
            scrollOffset={scrollOffset}
            isAngNavigation={isAngNavigation}
            debouncedScrollSave={debouncedScrollSave}
            handleRightArrow={handleRightArrow}
            pathId={route.params.pathId}
            isNavigating={isNavigating}
            onSaveCommit={commitSavedPathState}
            onSaveFailure={restoreDurableSaveHighlight}
            setCenterVerseId={setCenterVerseId}
            scrollToVerseId={scrollToVerseId}
            scrollToVerseRequestKey={scrollToVerseRequestKey}
            scrolledToSavedPath={scrolledToSavedPath}
            onScrollEndDrag={handleScrollEnd}
            onContentSizeChange={handleReaderContentSizeChange}
          />
        </PathSelectionProvider>
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
              onSettings={handleOpenSettings}
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
