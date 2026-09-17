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
import { displayReadingAng, showErrorAlert, convertNumberToFormat, recordError } from '@utils';
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
  useReadingSession,
} from '@hooks';
import { fontSizeIndexOf } from '@constants/FontSize';
import { ReaderFontSizeOverride } from '../hooks/useReaderFontSize';
import { store } from '../store';
import { saveGroupPankti } from '../store/groupPaths';
import { useAppSelector } from '../store/hooks';
import { useReaderFontSize } from '../hooks/useReaderFontSize';
import { savePathProgress, savePathScrollPosition, undoPathCompletion } from '../store/commands';
import { applyServerPathData } from '../store/slices/pathsSlice';
import { onScreenBlur, setActiveReaderPath } from '../store/syncLifecycle';
import { PathReader, PathNavigation, PathSelectionProvider, PathScreenOverlays } from '@components';
import { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { ErrorConstants, Routes, EDGES_ALL_SIDES, PATH_DATA } from '@constants';
import { getDurableSavedVerseId, getPathSavingMessage } from '../utils/pathProgress';

export { getDurableSavedVerseId, getPathSavingMessage } from '../utils/pathProgress';

type PathScreenProps = NativeStackScreenProps<RootStackParamList, 'Path'>;

/** Stands in for a handler a follower must not be able to fire. */
const noop = (): void => {};

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
  const isLarivaar = useAppSelector((state) => state.settings.larivaar);
  const isVishraam = useAppSelector((state) => state.settings.vishraam);
  const ownVishraamsSource = useAppSelector((state) => state.settings.vishraamsSource.source);

  /**
   * This device's own layout, reported to followers while it holds the turn.
   *
   * Memoised so a new object on every render does not re-send it — the effect
   * that publishes these fires on the value, and settings change when somebody
   * presses a switch, not several times a second.
   */
  const ownFontSizeIndex = useAppSelector((state) => fontSizeIndexOf(state.settings.fontSize));

  const ownLayout = useMemo(
    () => ({
      larivaar: isLarivaar,
      paragraphMode: isParagraphMode,
      vishraam: isVishraam,
      vishraamsSource: ownVishraamsSource,
      fontSizeIndex: ownFontSizeIndex,
    }),
    [isLarivaar, isParagraphMode, isVishraam, ownFontSizeIndex, ownVishraamsSource]
  );
  const angsFormat = useAppSelector((state) => state.settings.angsFormat);
  const fontSize = useReaderFontSize();
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
  // Updated by PathReader from its measured layout. This is more precise than
  // the centre verse when a reader is handed off mid-screen.
  const firstVisibleVerseId = useRef<number>(0);
  const explicitSaveForSession = useRef<{ angNumber: number; verseId: number } | null>(null);
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
    setCenterVerseId,
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

  const live = route.params?.live;

  /**
   * Watching somebody else read.
   *
   * The page is driven from elsewhere, so everything that would move it is
   * taken away rather than left to fight the incoming positions: no scrolling,
   * no ang controls, no save. What remains is the scripture and a note saying
   * whose reading it is.
   */
  const isFollowing = live !== undefined && !live.driving;

  /**
   * Read inside the initial-load callback, which captured its values at mount
   * and would otherwise decide with a stale `isFollowing`.
   */
  const followingRef = useRef(isFollowing);
  followingRef.current = isFollowing;

  /**
   * The last thing the group told us, kept so the initial load cannot bury it.
   *
   * The screen loads this device's OWN saved position on mount and assigns it
   * over everything — position, centre verse and highlight. For a follower that
   * is wrong twice over: their personal checkpoint has nothing to do with where
   * the group is, and the socket's answer often arrives first and was simply
   * overwritten. Both are remembered and re-applied once the page is up.
   */
  /** False until the group's position has placed this screen at least once. */
  const placedFromRemote = useRef(false);
  const latestRemote = useRef<{
    currentAng: number;
    currentVerseId: number;
    scrollPosition?: number;
  } | null>(null);
  const pendingRemotePosition = useRef<{
    currentAng: number;
    currentVerseId: number;
    scrollPosition?: number;
  } | null>(null);
  const readerLayoutRef = useRef<{
    larivaar?: boolean;
    paragraphMode?: boolean;
    vishraam?: boolean;
    vishraamsSource?: string;
    fontSizeIndex?: number;
  } | null>(null);
  const [readerLayout, setReaderLayout] = useState<{
    larivaar?: boolean;
    paragraphMode?: boolean;
    vishraam?: boolean;
    vishraamsSource?: string;
    fontSizeIndex?: number;
  } | null>(null);
  const latestSaved = useRef<{
    angNumber: number;
    verseId: number;
    scrollPosition: number;
  } | null>(null);

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

      // A shared path's checkpoint belongs to the group, and the local write
      // above never reaches the server — the middleware deliberately leaves
      // shared paths undirtied, so a long press saved to this device alone and
      // nobody else ever heard about it. `saveGroupPankti` writes it, adopts
      // whatever the server answers, and rolls back on failure; the server
      // then announces it to every member.
      if (live !== undefined) {
        // The ANSWER matters, not just the request.
        //
        // A save that would move the group backwards is accepted and ignored by
        // the server — it reports `behind` with the position that actually
        // stands, and publishes nothing, because nothing changed. This device
        // had already moved its own highlight optimistically, so it sat marking
        // a line the group is not on while every other member showed the real
        // one. That is why the highlight synced "sometimes": it worked whenever
        // the save moved forward, and silently diverged whenever it did not.
        //
        // Adopting the server's position puts this screen back where the group
        // is, which is also what it would have shown had the save come from
        // somebody else.
        saveGroupPankti(route.params.pathId, angNumber, verseId, scrollPosition)
          .then((result) => {
            if (result.status === 'behind') {
              setSavedAngNumber(result.angNumber);
              setSavedPathVerseId(result.verseId);
            }
          })
          .catch((error) => recordError(error, 'PathScreen: failed to save shared pankti'));
      }
    },
    [scrollOffset, setIsAngNavigation, live, route.params.pathId]
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

  const saveTakeoverPankti = useCallback(
    (verseId: number, scrollPosition: number) => {
      // A deliberate long-press save always wins. When no panktee was chosen
      // for this ang, use the first verse visible at the hand-off point.
      if (
        !live ||
        verseId <= 0 ||
        (explicitSaveForSession.current?.angNumber === pathAng &&
          explicitSaveForSession.current.verseId > 0)
      ) {
        return;
      }
      commitSavedPathState(pathAng, verseId, scrollPosition);
    },
    [commitSavedPathState, live, pathAng]
  );

  const handleReaderSaveCommit = useCallback(
    (angNumber: number, verseId: number, scrollPosition?: number, clearAngNavigation?: boolean) => {
      explicitSaveForSession.current = { angNumber, verseId };
      commitSavedPathState(angNumber, verseId, scrollPosition, clearAngNavigation);
    },
    [commitSavedPathState]
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
      explicitSaveForSession.current = null;
      firstVisibleVerseId.current = 0;
      // The old verse id belongs to the previous ang. If it survives an ang
      // jump, ending a group session writes that stale pankti against the new
      // ang and the next reader sees a mark nobody saved there.
      setCenterVerseId(0);
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
      const durableVerseId = getDurableSavedVerseId(durablePath.saveData, pathAng);
      // A scroll/quit checkpoint must use the verse currently at the top of
      // the viewport. The durable saved verse is only the last explicit save;
      // reusing it here made a reader's scroll position persist while the
      // saved verse silently stayed behind.
      const visibleVerseId = firstVisibleVerseId.current || centerVerseId;
      const verseIdToKeep =
        durablePath.saveData.angNumber === pathAng && visibleVerseId > durableVerseId
          ? visibleVerseId
          : durableVerseId;
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
      // `silent` only suppresses the ERROR alert: the navigation handler shows
      // the richer "leave anyway?" choice and a plain alert on top would be
      // noise. The sync still announces itself — this is progress the user
      // chose to save, and it is the one confirmation they get that leaving the
      // reader kept their place.
      const saved = await savePathProgress(
        route.params.pathId,
        pathAng,
        verseIdToKeep,
        scrollOffset.current,
        { silent: true, silentSync: false }
      );
      // Only mirror the save into local refs when it actually reached disk.
      if (saved) {
        commitSavedPathState(pathAng, verseIdToKeep, scrollOffset.current);
      }
      return saved;
    } catch (error) {
      return false;
    }
  }, [
    centerVerseId,
    commitSavedPathState,
    firstVisibleVerseId,
    pathAng,
    route.params.pathId,
    savedPathVerseId,
    scrollOffset,
  ]);

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

  const handleOpenSettings = useCallback(() => {
    navigation.push(Routes.Setting);
  }, [navigation]);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerVisible(false);
  }, []);

  /**
   * Both are refused while following.
   *
   * Hiding the on-screen controls was not enough: the drawer reaches the ang
   * picker and the save from a second direction, and either one moves a page
   * this device does not drive. The next position from the reader would snap it
   * back anyway, so the only thing a follower gains from them is a jolt.
   */

  const handleGoToAngPress = useCallback(() => {
    if (isFollowing) {
      return;
    }
    setIsAngsNavigationVisible(true);
  }, [isFollowing]);

  const handleSavePress = useCallback(() => {
    if (isFollowing) {
      return;
    }
    setIsSaving(true);
    fadeAnim.current.setValue(1);
  }, [isFollowing]);

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

  /**
   * Following, or being followed.
   *
   * `live` is present only when this screen was opened through the group
   * screen, which is the only place that knows whether this device holds the
   * turn. A personal path never opens a socket.
   */

  /**
   * Move this device to where the reader is.
   *
   * Reuses `jumpToAng` and the existing scroll-to-verse request rather than
   * inventing a second way to move the reader — the same path the ang picker
   * takes, so following behaves exactly like navigating.
   */
  const applyRemotePosition = useCallback(
    (position: { currentAng: number; currentVerseId: number; scrollPosition?: number }) => {
      const currentAng = displayReadingAng(position.currentAng);
      const normalizedPosition = { ...position, currentAng };
      // Marks the movement as machine-driven. Without it the follower's screen
      // sliding counts as them reading: `debouncedScrollSave` would write a
      // local checkpoint and `didReadThisSession` would credit a reading day to
      // somebody who only watched.
      isRestoringScroll.current = true;
      latestRemote.current = {
        currentAng,
        currentVerseId: position.currentVerseId,
        scrollPosition: position.scrollPosition,
      };

      // The joined snapshot can arrive in the same tick as the reader layout.
      // Wait for that layout to render before applying a pixel offset; otherwise
      // the offset is measured against this device's old font/line heights.
      if (isFollowing && !readerLayoutRef.current) {
        pendingRemotePosition.current = normalizedPosition;
        return;
      }

      if (currentAng !== pathAng) {
        // A different ang: let the verse place the reader. `jumpToAng` resets
        // the offset and the new content has not laid out yet, so a pixel
        // position from the previous page would land somewhere arbitrary.
        //
        // `jumpToAng` only moves the NUMBER — the ang controls pair it with
        // their own `fetchAngData` call, so following without this left the
        // header advancing over a page that never changed.
        placedFromRemote.current = true;
        jumpToAng(currentAng);
        setScrollToVerseId(position.currentVerseId);
        setScrollToVerseRequestKey((key) => key + 1);
        fetchFromBaniDB(currentAng).catch((error) => {
          recordError(error, 'PathScreen: failed to apply remote ang');
        });
      } else if (!placedFromRemote.current && position.currentVerseId > 0) {
        // The initial snapshot contains the reader's actual scroll position.
        // Apply it after the reader layout has rendered; centering only the
        // verse loses the reader's position whenever they are between verses.
        placedFromRemote.current = true;
        setScrollToVerseId(position.currentVerseId);
        setScrollToVerseRequestKey((key) => key + 1);
      } else if (typeof position.scrollPosition === 'number') {
        // Same ang, so this is the reader scrolling within the page. Follow the
        // offset directly: the verse only changes when the reader crosses a
        // line, so following by verse alone leaves the page still while they
        // move through it.
        //
        // A pixel offset is not portable in general — a different screen or
        // font size puts the same verse somewhere else — so the verse remains
        // the source of truth whenever the page changes, and this is a
        // refinement within it rather than a replacement for it.
        scrollOffset.current = position.scrollPosition;
        scrollRef.current?.scrollTo({ y: position.scrollPosition, animated: true });
      } else {
        setScrollToVerseId(position.currentVerseId);
        setScrollToVerseRequestKey((key) => key + 1);
      }

      // Released on the next tick so the scroll this triggered is covered, but
      // a follower who takes over scrolling themselves is not muted forever.
      setTimeout(() => {
        isRestoringScroll.current = false;
      }, 0);
    },
    [pathAng, jumpToAng, fetchFromBaniDB, isFollowing]
  );

  useEffect(() => {
    if (!isFollowing || !readerLayoutRef.current || !pendingRemotePosition.current) {
      return;
    }
    const pending = pendingRemotePosition.current;
    pendingRemotePosition.current = null;
    applyRemotePosition(pending);
  }, [isFollowing, readerLayout, applyRemotePosition]);

  /**
   * Mark the line the group has read to.
   *
   * Only a save moves this — never a position. A position is where the reader's
   * screen happens to be a few times a second, so following it moved the
   * highlight with their scrolling instead of holding it on the saved line.
   */
  /** The reader's text layout, while following. Never written to settings. */
  readerLayoutRef.current = readerLayout;

  /**
   * The last thing the group told us, kept so the initial load cannot bury it.
   *
   * The screen loads this device's OWN saved position on mount and assigns it
   * over everything — position, centre verse and highlight. For a follower that
   * is the wrong answer twice over: their personal checkpoint has nothing to do
   * with where the group is, and the socket's answer often arrives first and
   * was simply overwritten. So both are remembered and re-applied once the
   * page is on screen.
   */

  const applyRemoteSave = useCallback(
    (saved: { angNumber: number; verseId: number; scrollPosition?: number }) => {
      const scrollPosition = saved.scrollPosition ?? 0;
      latestSaved.current = { ...saved, scrollPosition };
      setSavedAngNumber(saved.angNumber);
      setSavedPathVerseId(saved.verseId);
      // Mirror the group checkpoint into this device's store. Without this,
      // another member could receive the socket event, then reopen the path
      // later and fall back to their stale personal checkpoint.
      const localPath = store
        .getState()
        .paths.paths.find((path) => path.pathId === route.params.pathId);
      if (localPath) {
        store.dispatch(
          applyServerPathData({
            pathId: route.params.pathId,
            pathPatch: {
              saveData: { angNumber: saved.angNumber, verseId: saved.verseId },
              progress: (saved.angNumber / PATH_DATA.LAST_ANG_NUMBER) * 100,
            },
            datePatch: { scrollPosition },
          })
        );
      }
      // Keep the server-owned group checkpoint available for the next open.
      // Do not scroll an already-open follower here: saved pankti and live
      // position are separate signals, and the live position remains the
      // source of truth during an active turn.
      if (matchedPath.current) {
        matchedPath.current.saveData = {
          angNumber: saved.angNumber,
          verseId: saved.verseId,
        };
      }
      if (matchedPathDate.current) {
        matchedPathDate.current.scrollPosition = scrollPosition;
      }
    },
    [route.params.pathId]
  );

  const {
    canDrivePage,
    confirmFinish,
    endedAt,
    endedBy,
    endedNoticeOpen,
    finishOpen,
    finishing,
    followedFontSize,
    followingLabel,
    leaveAfterReading,
    readerLabel: liveReaderLabel,
    readerLeftNoticeOpen,
    readerNotice,
    takeoverInProgress,
    readerRejoined,
    reportScroll,
    requestExit,
    setFinishOpen,
    setReaderLeftNoticeOpen,
  } = useReadingSession({
    live,
    pathId: route.params.pathId,
    pathAng,
    centerVerseId,
    scrollOffset,
    firstVisibleVerseId,
    ownLayout,
    readerLayout,
    navigation,
    onRemotePosition: applyRemotePosition,
    onRemoteSave: applyRemoteSave,
    onReaderLayout: setReaderLayout,
    onLeaveReader: handleGoBack,
    onFinishComplete: () => {
      // Finish has already written the current/jumped Ang to the group. Do
      // not ask a second save question while leaving the reader for Home.
      skipLeavePersist.current = true;
      setIsAngNavigation(false);
      navigation.popTo(Routes.Home);
    },
    onScroll: debouncedScrollSave,
    onTakeoverSave: saveTakeoverPankti,
    onError: showErrorAlert,
  });

  const handlePathDrawerNavigate = useCallback(
    (targetRoute: string, targetPathId?: number) => {
      // Settings is a round trip and does not leave the reader. Every other
      // drawer destination leaves an active shared turn, so force the Finish
      // sheet instead of offering the personal-path save/discard prompt.
      if (live?.driving && targetRoute !== Routes.Setting) {
        requestExit();
        return;
      }
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
    [confirmBeforeLeaving, handleDrawerNavigate, live?.driving, requestExit]
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
          const pathAngData = displayReadingAng(matchedPathData.saveData.angNumber);
          setSavedAngNumber(pathAngData);
          setSavedPathVerseId(matchedPathData.saveData.verseId);
          setCenterVerseId(matchedPathData.saveData.verseId);
          setPathAng(pathAngData);

          scrolledToSavedPath.current = false;
          await fetchFromBaniDB(pathAngData, { isInitialLoad: true });

          // The group's position wins for a follower, whether it arrived before
          // this load or lands after it. Without this the reader opens where
          // the GROUP is and the follower opens where THEY last stopped, which
          // is usually somewhere else entirely.
          if (live !== undefined) {
            const saved = latestSaved.current;
            if (saved) {
              setSavedAngNumber(saved.angNumber);
              setSavedPathVerseId(saved.verseId);
              matchedPath.current.saveData = {
                angNumber: saved.angNumber,
                verseId: saved.verseId,
              };
              if (matchedPathDate.current) {
                matchedPathDate.current.scrollPosition = saved.scrollPosition;
              }
            }
          }
        }
      } catch (error) {
        recordError(error, 'PathScreen: failed to load path data');
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PATH_DATA_GENERIC, () => fetchPath(), 'Retry');
      }
    };
    fetchPath();
  }, [route.params.pathId, live]);

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
    // A follower must never restore this device's saved checkpoint. The live
    // joined snapshot/position is the group's source of truth; allowing this
    // effect to run races the socket and can move the follower back to the
    // saved pankti while the reader is already elsewhere on the ang.
    if (isFollowing) {
      return;
    }
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
  }, [isFollowing, pathAng, pathContent, readerContentHeight, scrollToSavedPathData]);

  // Display settings come straight from the store, so there is no refresh-on-focus
  // step: a change in the Settings screen is already reflected here.

  // Maintain scroll position when font size or paragraph mode changes
  useEffect(() => {
    // While following, layout changes belong to the reader's live session.
    // Re-centering from this device's `centerVerseId` (which is initially its
    // own saved checkpoint) would overwrite the live scroll position just
    // after the reader settings are applied.
    if (isFollowing) {
      return;
    }
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
  }, [isFollowing, fontSize, isParagraphMode, pathContent, centerVerseId, savedPathVerseId]);
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        requestExit();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => subscription.remove();
    }, [requestExit])
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
            handleLeftArrow={isFollowing ? noop : handleLeftArrow}
            handleRightArrow={isFollowing ? noop : handleRightArrow}
            setIsAngsNavigationVisible={isFollowing ? noop : setIsAngsNavigationVisible}
            onMenuPress={() => setIsDrawerVisible(true)}
            isFollowing={isFollowing}
            onBackPress={() => navigation.replace(Routes.Home)}
          />
        </View>
        <ReaderFontSizeOverride.Provider value={followedFontSize}>
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
              firstVisibleVerseId={firstVisibleVerseId}
              isAngNavigation={isAngNavigation}
              debouncedScrollSave={reportScroll}
              handleRightArrow={handleRightArrow}
              pathId={route.params.pathId}
              isNavigating={isNavigating}
              onSaveCommit={handleReaderSaveCommit}
              onSaveFailure={restoreDurableSaveHighlight}
              setCenterVerseId={setCenterVerseId}
              scrollToVerseId={scrollToVerseId}
              scrollToVerseRequestKey={scrollToVerseRequestKey}
              scrolledToSavedPath={scrolledToSavedPath}
              isRestoringScroll={isRestoringScroll}
              onScrollEndDrag={handleScrollEnd}
              onContentSizeChange={handleReaderContentSizeChange}
              scrollEnabled={canDrivePage}
              canChangeAng={canDrivePage}
              layoutOverride={isFollowing ? readerLayout ?? undefined : undefined}
            />
          </PathSelectionProvider>
        </ReaderFontSizeOverride.Provider>
        <PathScreenOverlays
          alertIndicator={alertIndicator.current}
          isSaving={isSaving}
          found={found}
          isFollowing={isFollowing}
          requestExit={requestExit}
          setIsSaving={setIsSaving}
          fadeAnim={fadeAnim}
          onSettings={handleOpenSettings}
          followingLabel={followingLabel}
          readerNotice={readerNotice}
          takeoverInProgress={takeoverInProgress}
          readerLeftNoticeOpen={readerLeftNoticeOpen}
          readerRejoined={readerRejoined}
          endedBy={endedBy}
          endedAt={endedAt}
          endedNoticeOpen={endedNoticeOpen}
          readerLabel={liveReaderLabel}
          startedAt={live?.startedAt}
          onDismissReaderLeft={() => setReaderLeftNoticeOpen(false)}
          onLeaveAfterReading={leaveAfterReading}
          savingMessage={savingMessage}
          readerDriving={live?.driving === true}
          readerStartAng={live?.startAng}
          pathAng={pathAng}
          finishOpen={finishOpen}
          finishing={finishing}
          onConfirmFinish={confirmFinish}
          onCancelFinish={() => setFinishOpen(false)}
          isAngsNavigationVisible={isAngsNavigationVisible}
          setIsAngsNavigationVisible={setIsAngsNavigationVisible}
          onRightAng={handleAngsRightArrow}
          onLeftAng={handleAngsLeftArrow}
          isAngNavigation={isAngNavigation}
          setIsAngNavigation={setIsAngNavigation}
          fetchAngData={fetchFromBaniDB}
          updatePathAng={jumpToAng}
          drawerVisible={isDrawerVisible}
          onCloseDrawer={handleCloseDrawer}
          onNavigateDrawer={handlePathDrawerNavigate}
          pathId={route.params.pathId}
          onGoToAng={handleGoToAngPress}
          onSave={handleSavePress}
        />
      </View>
    </SafeAreaView>
  );
});
