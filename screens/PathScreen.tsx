/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showErrorAlert, convertNumberToFormat, recordError } from '@utils';
import { getAngContent } from '../db';
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
import { savePathProgress, savePathScrollPosition, undoPathCompletion } from '../store/commands';
import { onScreenBlur, setActiveReaderPath } from '../store/syncLifecycle';
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
  const isRestoringScroll = useRef<boolean>(false);
  const scrollOffset = useRef<number>(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const alertIndicator = useRef<React.ReactNode | undefined>(undefined);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1));
  const [readerContentHeight, setReaderContentHeight] = useState<number>(0);
  // Seed these with the CURRENT settings, not hardcoded defaults.
  //
  // The "keep the same verse centred when the layout changes" effect compares
  // against these. Starting them at 18/false meant the first render of a reader
  // whose settings differ from those defaults looked like a settings change:
  // with paragraph mode ON, `false -> true` fired a recentre request on mount
  // that nobody asked for, and it fought the restore of the saved scroll
  // position. That is why the janky resume showed up in paragraph mode only,
  // and why it surfaced in release builds — faster JS lands the spurious
  // recentre mid-animation instead of harmlessly after it.
  const previousFontSize = useRef<number>(fontSize);
  const previousParagraphMode = useRef<boolean>(isParagraphMode);
  const [scrollToVerseId, setScrollToVerseId] = useState<number>(0);
  const [scrollToVerseRequestKey, setScrollToVerseRequestKey] = useState<number>(0);
  const completionUndoPendingRef = useRef<boolean>(false);
  // Baseline scroll Y captured when completion guard starts; used to measure
  // upward movement and undo completion only after user scrolls up > 200px.
  const completionUndoStartScrollYRef = useRef<number | null>(null);
  /** Guards the leave checkpoint so `blur` + `beforeRemove` run it only once. */
  const leaveCheckpointDone = useRef<boolean>(false);
  /**
   * Set when the user explicitly declines to save before leaving.
   *
   * Declining navigates immediately, and `beforeRemove` fires the leave
   * checkpoint on the way out — which would persist `pathAng`. That is still the
   * jumped ang: the revert is a `setState` that has not committed, and the
   * checkpoint closes over the previous render's value either way. Without this
   * flag, "don't save" saved exactly what the user declined.
   */
  const skipLeavePersist = useRef<boolean>(false);
  // Set once the reader auto-saves a position the user scrolled to themselves.
  // The leave checkpoint needs this because the auto-save writes the scroll
  // offset WITHOUT recording a reading day, which makes the durable state look
  // identical to "opened and left untouched".
  const didReadThisSession = useRef<boolean>(false);

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
    async (angNumber: number, options?: { isInitialLoad?: boolean }) => {
      alertIndicator.current = <ActivityIndicator size={'large'} color={'#000'} />;
      setReaderContentHeight(0);
      const pathFromBaniDB = await getAngContent(angNumber);
      alertIndicator.current = undefined;
      if (pathFromBaniDB.success === false) {
        // Local DB was missing or unreadable, and the API fallback failed.
        // Only this fallback path needs a connectivity check.
        const isConnected = await checkNetwork();
        if (!isConnected) {
          setRetryState({ needsRetry: true, lastFailedAng: angNumber });
          Alert.alert(
            'Error',
            `${ErrorConstants.NO_INTERNET_TITLE}\n${ErrorConstants.NO_INTERNET_MESSAGE}\n\n`,
            [
              {
                text: 'OK',
                // Leaving is only right for the FIRST load, which has no content
                // to fall back to. Turning a page has content already on screen,
                // so sending the reader Home would throw away what they are
                // reading over a page that simply could not be fetched — and the
                // effect below re-fetches it as soon as the network returns.
                onPress: options?.isInitialLoad ? () => navigation.replace(Routes.Home) : undefined,
              },
            ]
          );
        } else {
          navigation.replace(Routes.Error);
        }
        return false;
      }
      setPathContent(pathFromBaniDB.data);
      setRetryState({ needsRetry: false, lastFailedAng: null });
      resetTransientUiState();
      const currentDebounceTimer = debounceTimer.current;
      if (currentDebounceTimer !== null) {
        clearTimeout(currentDebounceTimer);
        debounceTimer.current = null;
      }
      return true;
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
      // A saved checkpoint can emit `onScroll` while the reader restores it.
      // Do not turn that already-synced movement into another local update.
      if (isRestoringScroll.current) {
        return;
      }
      try {
        // Store reading position locally, but do not create an API operation
        // while the user is still reading. Leaving/backgrounding/manual Sync
        // promotes this latest checkpoint and uploads it once.
        const saved = await savePathScrollPosition(route.params.pathId, scrollOffset.current);
        if (!saved) {
          return;
        }
        // `isRestoringScroll` above already excluded the restore, so reaching
        // here means the user moved through the text themselves — they read.
        didReadThisSession.current = true;
      } catch {
        // Background auto-save remains silent; the command records the failure.
      }
    }, 200);
  }, [route.params.pathId]);

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
    isRestoringScroll,
    scrollRef,
    scrollOffset,
    setFound,
    fontSize,
    isParagraphMode,
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
      const current = store.getState().paths;
      const durablePath = current.paths.find((path) => path.pathId === route.params.pathId);
      const durableDate = current.dates.find((date) => date.pathid === route.params.pathId);
      if (!durablePath) {
        return false;
      }
      // Same rule as the auto-save: a verse from another ang must not be paired
      // with the ang being displayed now.
      const verseIdToKeep = getDurableSavedVerseId(durablePath.saveData, pathAng);
      // Opening a path restores its saved ang/scroll position. Leaving straight
      // away must not turn that restore into a new "read today" update: it can
      // block newer progress fetched from another device despite A doing nothing.
      //
      // The durable comparison alone cannot tell that apart from a real reading
      // session, because the scroll auto-save has already written the position
      // the user scrolled to — and it records no reading day of its own. Reading
      // within one ang therefore matched on all three and returned here, so the
      // day never reached `dates` and the streak missed it. `didReadThisSession`
      // is the part the durable state cannot express.
      const unchangedSinceOpen =
        !didReadThisSession.current &&
        durablePath.saveData.angNumber === pathAng &&
        durablePath.saveData.verseId === verseIdToKeep &&
        (durableDate?.scrollPosition ?? 0) === scrollOffset.current;
      if (unchangedSinceOpen) {
        return true;
      }
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

  const checkpointScrollBeforeBackground = useCallback(async () => {
    // Do not let the 200ms debounce race the app suspension. Persist the newest
    // in-memory offset now, then let the normal lifecycle code queue/flush it.
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    // The user chose to leave without saving. Skip the write, but still run the
    // blur handler: it promotes and flushes progress saved EARLIER in this
    // session, which they did not decline.
    if (skipLeavePersist.current) {
      skipLeavePersist.current = false;
      onScreenBlur();
      return;
    }
    await persistCurrentScrollPosition();
    onScreenBlur();
  }, [persistCurrentScrollPosition]);

  const { handleGoBack, confirmBeforeLeaving } = usePathNavigation({
    isAngNavigation,
    pathAng,
    pathId: route.params.pathId,
    setIsAngNavigation,
    updatePathAng,
    navigation,
    persistCurrentScroll: persistCurrentScrollPosition,
    suppressLeaveSave: () => {
      skipLeavePersist.current = true;
    },
  });

  const handlePathDrawerNavigate = useCallback(
    (targetRoute: string, targetPathId?: number) => {
      const destinationLabels: Record<string, string> = {
        Home: 'Home',
        Setting: 'Settings',
        Progress: 'Progress',
        Streaks: 'Streaks',
      };
      return confirmBeforeLeaving(
        () => handleDrawerNavigate(targetRoute, targetPathId),
        destinationLabels[targetRoute] ?? 'that screen'
      );
    },
    [confirmBeforeLeaving, handleDrawerNavigate]
  );

  const handleOpenSettings = useCallback(() => {
    navigation.push(Routes.Setting);
  }, [navigation]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerVisible(false);
  }, []);

  const handleGoToAngPress = useCallback(() => {
    setIsAngsNavigationVisible(true);
  }, []);

  const handleSavePress = useCallback(() => {
    setIsSaving(true);
    fadeAnim.current.setValue(1);
  }, []);

  /**
   * Ang navigation jumps to a different ang, so the old scroll offset means
   * nothing there — keeping it drops the reader part-way down a page they have
   * not seen. The arrows already reset it; this is what makes "go to ang" match.
   *
   * Reset before `updatePathAng` so the new content renders at the top rather
   * than visibly jumping after it lands.
   */
  const jumpToAng = useCallback(
    (angNumber: number) => {
      scrollOffset.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      updatePathAng(angNumber);
    },
    [updatePathAng]
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
    () => getPathSavingMessage(isSaved, hasPendingVerseSelection),
    [isSaved, hasPendingVerseSelection]
  );

  useEffect(() => {
    scrolledToSavedPath.current = false;
    isRestoringScroll.current = false;
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
          // Seed this synchronously. The visual scroll restore waits for reader
          // content/layout, but a background or navigation checkpoint can happen
          // before that effect runs and must preserve the already-saved offset.
          scrollOffset.current = matchedPathDateData?.scrollPosition ?? 0;
          completionUndoPendingRef.current = false;
          completionUndoStartScrollYRef.current = null;
          const pathAngData =
            matchedPathData.saveData.angNumber === 0 ? 1 : matchedPathData.saveData.angNumber;
          setSavedAngNumber(pathAngData);
          setSavedPathVerseId(matchedPathData.saveData.verseId);
          setCenterVerseId(matchedPathData.saveData.verseId);
          setPathAng(pathAngData);

          scrolledToSavedPath.current = false;
          await fetchFromBaniDB(pathAngData, { isInitialLoad: true });
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
    // Content size has already reached the saved position. One frame lets the
    // native ScrollView commit that layout; a second frame only delayed the
    // resume animation and made the reader appear to hesitate on Android.
    firstFrame = requestAnimationFrame(() => {
      scrollToSavedPathData();
    });

    return () => {
      if (firstFrame !== null) {
        cancelAnimationFrame(firstFrame);
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

  // Leaving the reader — back press, the drawer, or the home icon all land here.
  //
  // Runs the SAME checkpoint the app-background path uses, rather than calling
  // `onScreenBlur` alone: the scroll save is debounced by 200 ms, so closing
  // mid-debounce left the newest offset only in memory. Promotion then found
  // nothing to queue and the reader's final position was not sent until some
  // later trigger. Cancelling the debounce and persisting first makes closing
  // the path sync exactly where the user stopped, immediately.
  // Checkpoint only when the reader is REALLY being left.
  //
  // `beforeRemove` — not `blur` — is the right event for two reasons:
  //  1. Going Home uses `navigation.popTo(Home)`, which REMOVES this screen.
  //     React unmounts it and the cleanup below tears the listener down, so a
  //     `blur` handler never runs at all — the checkpoint (and its "Synced"
  //     confirmation) was silently skipped on every exit.
  //  2. `blur` ALSO fires for a push that keeps this screen mounted — opening
  //     Settings. That is a round trip: the user comes straight back here, so
  //     uploading then is a pointless API call. `beforeRemove` never fires for
  //     it, so Settings no longer triggers a sync.
  //
  // App backgrounding is covered separately by the AppState listener below.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (leaveCheckpointDone.current) {
        return;
      }
      leaveCheckpointDone.current = true;
      checkpointScrollBeforeBackground().catch((error) =>
        recordError(error, 'PathScreen: leaving the reader failed to checkpoint')
      );
    });
    return unsubscribe;
  }, [navigation, checkpointScrollBeforeBackground]);

  // While the reader is focused: register it as the active path (so a foreground
  // GET /paths refresh never overwrites/removes the path being read), and run the
  // scroll checkpoint on background — the 'blur' event above doesn't fire when the
  // app is backgrounded with the reader still focused.
  useFocusEffect(
    useCallback(() => {
      const { pathId } = route.params;
      setActiveReaderPath(pathId);
      // Re-arm the leave checkpoint: returning to the reader (e.g. back from
      // Settings) must be able to checkpoint again when the user leaves next.
      leaveCheckpointDone.current = false;
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'inactive' || state === 'background') {
          checkpointScrollBeforeBackground();
        }
      });
      return () => {
        setActiveReaderPath(null);
        subscription.remove();
      };
    }, [route.params.pathId, checkpointScrollBeforeBackground])
  );

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
            isRestoringScroll={isRestoringScroll}
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
            updatePathAng={jumpToAng}
          />
        )}
        <DrawerMenu
          isVisible={isDrawerVisible}
          onClose={handleCloseDrawer}
          onNavigate={handlePathDrawerNavigate}
          currentRoute={Routes.Path}
          pathId={route.params.pathId}
          onGoToAngPress={handleGoToAngPress}
          onSavePress={handleSavePress}
        />
      </View>
    </SafeAreaView>
  );
});
