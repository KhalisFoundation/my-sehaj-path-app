import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  View,
  ScrollView,
  ImageBackground,
  Pressable,
  Image,
} from 'react-native';
import { AppText as Text } from '../components/AppText';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import {
  BackButton,
  NavContent,
  SecondaryButton,
  SimpleText,
  SecondaryHeading,
  ImportantText,
  PathRename,
  PathOptionsMenu,
  Calender,
  MembersRow,
  InviteSheet,
  SuggestedMembersSheet,
  TurnsTab,
} from '@components';
import {
  Constants,
  EDGES_ALL_SIDES,
  ErrorConstants,
  Routes,
  PATH_DATA,
  UIConstants,
} from '@constants';
import { ContinueScreenStyles, SafeAreaStyle } from '@styles';
import { PathData, useScreenAnalytics } from '@hooks';
import { startLogin } from '@auth';
import {
  displayReadingAng,
  recordError,
  showErrorAlert,
  trackEvent,
  trackSharedPathEvent,
} from '@utils';
import { store } from '../store';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectVisiblePaths } from '../store/selectors';
import { canInvite, isPersonalPath, isTurnStillLive } from '../store/groupPaths';
import {
  listMembers,
  listActiveInvites,
  avatarUrlFor,
  avatarHeaders,
  currentSession,
  cancelSlot,
  loadPlan,
  startReading,
  takeoverReading,
  leavePath,
  makeMemberAdmin,
  setMemberAdmin,
  removeMember,
} from '../store/groupApi';
import { turnAt, UPCOMING_TURN_LOOKAHEAD_DAYS } from '../store/slotAvailability';
import type { SehajPathMember, SehajPathSlot } from '@api/generated/types.gen';
import { ContinueIcon } from '@icons';
import { initialOf } from '../components/MemberAvatars';
import { getAngContent } from '../db';
import { RootStackParamList } from '../App';
import { ContinueScreenBackground } from '../assets/Images';
import { onForeground } from '../store/syncLifecycle';
import { setPathShared } from '../store/slices/syncSlice';
import { persistence } from '../store/instance';
import { getStoredInviteState } from '../store/inviteLink';
import { connectLive, type LiveHandle, type LivePosition } from '../store/liveSession';
import {
  addLocalDays,
  asLocalDateTime as dayjs,
  differenceInMinutes,
  isAfter,
  parseLegacyPathDate,
} from '../utils/dateTime';

type ContinueProps = NativeStackScreenProps<RootStackParamList, 'Continue'>;

const formatLiveReaderTime = (reader: {
  startedAt: string;
  slotEndsAt: string | null | undefined;
}): string =>
  [
    dayjs(reader.startedAt).format('h:mm A'),
    reader.slotEndsAt ? dayjs(reader.slotEndsAt).format('h:mm A') : 'Now',
  ].join(' - ');

export const Continue = ({ route, navigation }: ContinueProps) => {
  const { pathId, initialTab } = route.params;

  /**
   * Group data is loaded only when a path can be represented on the server.
   * Turns is available only after another active member has joined. Members
   * remains available for personal paths so the owner can create/share one.
   */
  const syncMeta = useAppSelector((state) => state.sync.meta);
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector((state) => state.network.isOnline);
  const isSignedIn = useAppSelector((state) => state.auth.status === 'signedIn');
  const authDisplayName = useAppSelector((state) => {
    const name = [state.auth.firstname, state.auth.lastname]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(' ')
      .trim();
    return name || state.auth.email || Constants.YOU;
  });
  const groupMeta = syncMeta[pathId];
  const groupMetaShared = groupMeta?.shared;
  const groupMetaGroupId = groupMeta?.groupId;

  /**
   * Two different questions, and conflating them made the invite button
   * unreachable: a path becomes shared BY being invited into.
   *
   * `invitableId` — the server knows this path, so it can be shared. This is
   * what the members row and the `+` need. Both are the SERVER's id for the
   * path (`groupId`), never the id this device syncs under — the group
   * endpoints answer the latter with a 404.
   * `sehajPathId` — it IS shared, so there are turns to schedule and a live
   * reading to join.
   */
  const invitableId = canInvite(groupMeta) ? groupMeta.groupId : null;

  const [members, setMembers] = useState<SehajPathMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteAutoCreate, setInviteAutoCreate] = useState(false);
  const [suggestedMembersOpen, setSuggestedMembersOpen] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<'unknown' | 'none' | 'active' | 'expired'>(
    'unknown'
  );
  const [inviteExpiryHours, setInviteExpiryHours] = useState<number | null>(168);
  // Several focus/sync effects can refresh members at the same time. Keep
  // only the newest response; an older 404 must not replace a newer local
  // member list with the generic error state.
  const membersLoadVersionRef = useRef(0);
  const inviteStatusLoadVersionRef = useRef(0);
  const loginPromptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeMembers = useMemo(
    () => members.filter((member) => member.status === 'ACTIVE'),
    [members]
  );
  const membersForDisplay = useMemo(() => {
    if (members.length > 0) {
      return members;
    }
    return [
      {
        id: `local-member-${pathId}`,
        userId: null,
        isMine: true,
        role: 'ADMIN' as const,
        status: 'ACTIVE' as const,
        displayLabel: authDisplayName,
        joinedAt: null,
      },
    ];
  }, [authDisplayName, members, pathId]);
  // A path's start date is its server path date. Reading days belong to the
  // streak calculation only: using the first shared reading day here made a
  // path created two days ago become "started 1 day ago" after refresh.
  const sharedStartDate = groupMeta?.startDate;
  const hasOtherMember = activeMembers.some((member) => !member.isMine);
  // Keep the shared UI available immediately from the persisted sync flag.
  // Membership is refreshed in the background, so waiting for that request
  // made Continue briefly look like a personal path on every launch.
  const isSharedPath = hasOtherMember || groupMetaShared === true;
  // Turns is a group-only feature. Wait for the persisted/server-confirmed
  // shared flag instead of optimistically rendering it while metadata is still
  // unknown; otherwise a personal path flashes Turns and removes it again as
  // the first sync completes.
  const showTurnsTab = groupMetaShared === true;

  // A link makes a path shareable, not shared. Its owner is the first active
  // membership, so group turns and live-reading rules begin only once another
  // active member exists.
  const sehajPathId = isSharedPath ? invitableId : null;

  useEffect(() => {
    if (sehajPathId === null || isOnline) {
      return;
    }
    Alert.alert(
      Constants.SHARED_PATH_OFFLINE_TITLE,
      Constants.SHARED_PATH_OFFLINE_MESSAGE,
      [{ text: Constants.OK, onPress: () => navigation.goBack() }],
      { cancelable: false }
    );
  }, [isOnline, navigation, sehajPathId]);

  const isSharedPathAdmin = activeMembers.some(
    (member) => member.isMine && member.role === 'ADMIN'
  );
  const isLastActiveAdmin =
    isSharedPathAdmin && !activeMembers.some((member) => !member.isMine && member.role === 'ADMIN');
  const hasOnlyCurrentMember = isPersonalPath(activeMembers);
  // Personal paths are owned by the local user. Shared paths are governed by
  // the server membership role, so regular members must not receive owner
  // controls such as rename or delete.
  const canManagePath = sehajPathId === null || hasOnlyCurrentMember || isSharedPathAdmin;

  const loadMembers = useCallback(async () => {
    const requestVersion = ++membersLoadVersionRef.current;
    if (!invitableId || groupMetaShared === false) {
      // The path has not reached the server yet, so there is no membership
      // endpoint to ask. A personal path may still have a server id (and an
      // invite can be created for it), but it is not PUBLIC and therefore the
      // members endpoint correctly returns 404. The local fallback below is
      // the member row that should be shown in that state.
      setMembers([]);
      setMembersError(null);
      return;
    }
    const result = await listMembers(invitableId);
    if (requestVersion !== membersLoadVersionRef.current) {
      return;
    }
    // Every membership, not only the active ones: a pending request is not a
    // member, but it IS the thing an admin has to act on, and the only place
    // that is visible is here.
    if (!result.ok) {
      // During the first render the sync metadata may not yet have learned
      // that this is a personal path. Treat that expected 404 exactly like
      // the explicit `shared === false` branch above. Real shared paths keep
      // the error and retry UI, including deleted/inaccessible paths.
      if (result.kind === 'refused' && result.status === 404 && groupMetaShared !== true) {
        setMembers([]);
        setMembersError(null);
        return;
      }
      setMembers([]);
      setMembersError(result.message || ErrorConstants.FAILED_TO_LOAD_MEMBERS);
      return;
    }

    const nextMembers = result.data;
    // Membership determines whether the Turns tab exists. Animate the
    // resulting layout change instead of letting the tab appear abruptly
    // after Continue has already rendered.
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMembers(nextMembers);
    setMembersError(null);
    // The active member list is the immediate source of truth. Updating the
    // durable mode here means Continue's personal fallback and PathScreen's
    // save strategy agree even before the next full foreground refresh.
    const shared = nextMembers.some((member) => member.status === 'ACTIVE' && !member.isMine);
    if (groupMetaShared !== shared || groupMetaGroupId !== invitableId) {
      dispatch(
        setPathShared({
          pathId,
          groupId: invitableId,
          shared,
        })
      );
    }
    // Ensure the path start date and shared-mode flag are both durable before
    // a rapid app close/reopen. This is intentionally a flush of the existing
    // persistence coordinator, not a second cache or storage key.
    await persistence.flush();
  }, [dispatch, groupMetaGroupId, groupMetaShared, invitableId, pathId]);

  const loadInviteStatus = useCallback(async () => {
    const requestVersion = ++inviteStatusLoadVersionRef.current;
    if (!invitableId) {
      setInviteStatus('none');
      return;
    }
    const [active, storedState] = await Promise.all([
      listActiveInvites(invitableId),
      getStoredInviteState(invitableId),
    ]);
    // A link can be created while an older status request is still in flight.
    // Never let that stale response hide the newly-created active link.
    if (requestVersion !== inviteStatusLoadVersionRef.current) {
      return;
    }
    if (active.ok && active.data.length > 0) {
      setInviteStatus('active');
    } else {
      setInviteStatus(storedState === 'expired' ? 'expired' : 'none');
    }
  }, [invitableId]);

  useEffect(() => {
    loadMembers().catch(() => undefined);
    loadInviteStatus().catch(() => setInviteStatus('unknown'));
  }, [loadInviteStatus, loadMembers]);

  /**
   * Re-read on focus, not only on mount.
   *
   * Returning from the approval screen is the case that matters: the admin has
   * just changed exactly this list, and a stale copy would keep offering a
   * decision they have already made.
   */
  useFocusEffect(
    useCallback(() => {
      loadMembers().catch(() => undefined);
      loadInviteStatus().catch(() => setInviteStatus('unknown'));
    }, [loadInviteStatus, loadMembers])
  );

  useScreenAnalytics('Continue', 'Continue');
  const [pathState, setPathState] = useState({
    pathData: {
      pathId: 0,
      saveData: { angNumber: 0, verseId: 0 },
      progress: 0,
      startDate: '',
      completionDate: '',
      pathName: '',
    },
    pathAng: 0,
    pathPercentage: 0,
    daysAgo: 0,
    averageAngs: 0,
    finishDate: '',
    showData: false,
    pathName: '',
  });

  const [uiState, setUiState] = useState({
    showPathRename: false,
    tabs: initialTab || 'progress',
    streakValue: null as number | null,
  });
  useEffect(() => {
    if (!showTurnsTab && uiState.tabs === 'turns') {
      setUiState((previous) => ({ ...previous, tabs: 'progress' }));
    }
  }, [showTurnsTab, uiState.tabs]);
  const showMemberSummary =
    (uiState.tabs === 'progress' || uiState.tabs === 'streak') &&
    isSignedIn &&
    sehajPathId !== null &&
    activeMembers.length > 0;
  const showTurnsContent =
    isSignedIn && showTurnsTab && uiState.tabs === 'turns' && sehajPathId !== null && isSharedPath;

  // A newly-created personal path has no server group until its first
  // foreground sync. Opening Members is the explicit request to share it, so
  // provision that group before showing the share-link action.
  useEffect(() => {
    if (isSignedIn && uiState.tabs === 'members' && sehajPathId === null && invitableId === null) {
      onForeground(null).catch(() => undefined);
    }
  }, [invitableId, isSignedIn, sehajPathId, uiState.tabs]);

  const handleSharePath = useCallback(async () => {
    if (!isSignedIn) {
      if (invitableId !== null) {
        setInviteAutoCreate(false);
        setInviteOpen(true);
      } else {
        Alert.alert(Constants.INVITE_SIGN_IN_TITLE, Constants.INVITE_SIGN_IN_REQUIRED);
      }
      return;
    }
    if (invitableId !== null) {
      setInviteAutoCreate(false);
      setInviteOpen(true);
      return;
    }

    // A personal path needs its server counterpart before an invite can be
    // minted. `onForeground` owns the outbox ordering; read the resulting
    // metadata directly so this tap either opens the invite sheet or explains
    // why it could not.
    try {
      await onForeground(null);
    } catch (error) {
      recordError(error, 'Continue: failed to sync before sharing');
      showErrorAlert(ErrorConstants.FAILED_TO_SHARE_PATH);
      return;
    }
    const refreshedMeta = store.getState().sync.meta[pathId];
    if (canInvite(refreshedMeta)) {
      setInviteAutoCreate(false);
      setInviteOpen(true);
      return;
    }
    Alert.alert(
      'Unable to share this path',
      'Please check your connection, let the path sync, and try again.'
    );
  }, [invitableId, isSignedIn, pathId]);

  const handleCreateInvite = useCallback(
    async (autoCreate = true) => {
      if (!isSignedIn) {
        if (invitableId !== null) {
          setInviteAutoCreate(false);
          setInviteOpen(true);
        } else {
          Alert.alert(Constants.INVITE_SIGN_IN_TITLE, Constants.INVITE_SIGN_IN_REQUIRED);
        }
        return;
      }
      if (invitableId === null) {
        try {
          await onForeground(null);
        } catch (error) {
          recordError(error, 'Continue: failed to sync before creating invite');
          showErrorAlert(ErrorConstants.FAILED_TO_SHARE_PATH);
          return;
        }
        const refreshedMeta = store.getState().sync.meta[pathId];
        if (!canInvite(refreshedMeta)) {
          Alert.alert(
            'Unable to share this path',
            'Please check your connection, let the path sync, and try again.'
          );
          return;
        }
      }
      setInviteAutoCreate(autoCreate);
      setInviteOpen(true);
    },
    [invitableId, isSignedIn, pathId]
  );

  const streak = useRef<number>(0);
  /** Set while a delete is in flight, so the path vanishing is not an error. */
  const isDeletingRef = useRef<boolean>(false);
  const matchedPath = useAppSelector((state) =>
    selectVisiblePaths(state).find((path: PathData) => path.pathId === pathId)
  );
  const previousRoute = useNavigationState((state) => state.routes[state.index - 1]?.name);
  const isFromPath = previousRoute === Routes.Path;

  const handleStreakUpdate = useCallback((newStreakValue: number | null) => {
    setUiState((prev) => ({ ...prev, streakValue: newStreakValue }));
  }, []);

  const calculatePathCompletion = useCallback((path: PathData, serverStartDate?: number) => {
    const today = dayjs().startOf('day');
    // A member can open a shared path before the local path record has been
    // refreshed with the server-owned start date. Use sync metadata as the
    // authoritative fallback so the projected completion date is still shown.
    let startDate = dayjs('invalid');
    // Shared paths have one group start date. A member's local record may
    // have been created on the day they joined, so prefer the server value
    // whenever it is available instead of showing a misleading 0-day age.
    if (serverStartDate) {
      startDate = dayjs(serverStartDate).startOf('day');
    } else if (path.startDate) {
      startDate = parseLegacyPathDate(path.startDate).startOf('day');
    }
    if (!startDate.isValid()) {
      return {
        finishDate: '',
        daysAgo: 0,
        averageAngs: path.saveData.angNumber || 0,
      };
    }
    const days = Math.max(0, today.diff(startDate, 'day'));
    const averageMatchedAngs = (path.saveData.angNumber || 0) / (days ? days : 1);

    const remainingAngs = PATH_DATA.LAST_ANG_NUMBER - path.saveData.angNumber;
    const remainingDays = remainingAngs / (averageMatchedAngs ? averageMatchedAngs : 1);
    const completionDate = today.add(remainingDays, 'day');

    return {
      finishDate: dayjs(completionDate).format('D-MMMM-YYYY'),
      daysAgo: today.format('D-MMMM-YYYY') === startDate.format('D-MMMM-YYYY') ? 0 : days,
      averageAngs: averageMatchedAngs === Infinity ? 0 : parseFloat(averageMatchedAngs.toFixed(2)),
    };
  }, []);

  const updateTheData = useCallback(() => {
    if (!matchedPath) {
      // A path the user just deleted is SUPPOSED to disappear. Reporting that as
      // a failed load told them the delete had gone wrong when it had worked.
      if (isDeletingRef.current) {
        return;
      }
      showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PATH_DATA, () => navigation.goBack(), 'Retry');
      return;
    }
    const storedPathAng = matchedPath.saveData.angNumber || 0;
    const pathAng = displayReadingAng(storedPathAng);
    const pathPercentage = parseFloat(
      ((storedPathAng / PATH_DATA.LAST_ANG_NUMBER) * 100).toFixed(2)
    );
    const { finishDate, daysAgo, averageAngs } = calculatePathCompletion(
      matchedPath,
      sharedStartDate
    );

    setPathState((previous) => {
      if (
        previous.pathAng === pathAng &&
        previous.pathPercentage === pathPercentage &&
        previous.daysAgo === daysAgo &&
        previous.averageAngs === averageAngs &&
        previous.finishDate === finishDate &&
        previous.pathName === matchedPath.pathName &&
        previous.showData === pathAng >= 10
      ) {
        return previous;
      }
      return {
        pathData: matchedPath,
        pathAng,
        pathPercentage,
        daysAgo,
        averageAngs,
        finishDate,
        showData: pathAng >= 10,
        pathName: matchedPath.pathName,
      };
    });
  }, [calculatePathCompletion, matchedPath, navigation, sharedStartDate]);

  // Render the persisted cache immediately, then refresh shared data in the
  // background. The selector/update effect applies the server response when
  // it arrives, so the screen never needs to block on network latency.
  useFocusEffect(updateTheData);
  useEffect(() => {
    onForeground(null)
      .then(() => loadMembers())
      .catch(() => undefined);
  }, [loadMembers]);

  // Member metadata arrives after the local path row. Recalculate once it is
  // available so elapsed days and the projected average match every account.
  useEffect(() => {
    if (activeMembers.length > 0) {
      updateTheData();
    }
  }, [activeMembers.length, updateTheData]);

  // The reader content is bundled with the app, so Continue must work fully
  // offline. Network state only affects cloud sync, never opening a path.
  const [joining, setJoining] = useState(false);
  const [readAlongAvailable, setReadAlongAvailable] = useState(false);
  const [ownLiveSession, setOwnLiveSession] = useState<{
    sessionId: string;
    startAng: number;
    startedAt: string;
    slotEndsAt: string | null | undefined;
  } | null>(null);
  const [liveReader, setLiveReader] = useState<{
    sessionId: string;
    member: SehajPathMember | null;
    label: string;
    startedAt: string;
    slotEndsAt: string | null | undefined;
    startAng: number;
    currentAng: number;
  } | null>(null);
  const [upcomingTurn, setUpcomingTurn] = useState<SehajPathSlot | null>(null);
  const [activeOwnTurn, setActiveOwnTurn] = useState<SehajPathSlot | null>(null);
  const [scheduleSlots, setScheduleSlots] = useState<SehajPathSlot[]>([]);
  const [upcomingTurnsLoading, setUpcomingTurnsLoading] = useState(false);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  /** The live socket is the source of truth for the preview's current position. */
  const [livePreviewPosition, setLivePreviewPosition] = useState<LivePosition | null>(null);
  const previewLiveRef = useRef<LiveHandle | null>(null);
  const previewScrollRef = useRef<ScrollView | null>(null);
  const hasActiveSharedSession = sehajPathId !== null && liveReader !== null;
  const showUpcomingTurns = sehajPathId !== null && isSharedPath && uiState.tabs === 'progress';

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const refreshLiveReader = async () => {
        if (!sehajPathId) {
          setReadAlongAvailable(false);
          setLiveReader(null);
          setOwnLiveSession(null);
          return;
        }
        const result = await currentSession(sehajPathId);
        // A transient request failure must not erase a reader that was already
        // shown. The focus effect retries on its interval; only a successful
        // response proving that there is no live session may clear the card.
        if (!result.ok) {
          return;
        }
        if (!result.data || !isTurnStillLive(result.data)) {
          if (!cancelled) {
            setReadAlongAvailable(false);
            setLiveReader(null);
            setOwnLiveSession(null);
          }
          return;
        }
        const session = result.data;
        let loaded = members;
        if (loaded.length === 0) {
          const fetched = await listMembers(sehajPathId);
          loaded = fetched.ok ? fetched.data : [];
        }
        const mine = loaded.find((member) => member.isMine);
        if (!cancelled) {
          const isAnotherReader = mine === undefined || session.readerMemberId !== mine.id;
          setReadAlongAvailable(isAnotherReader);
          const readerMember = session.readerMemberId
            ? loaded.find((member) => member.id === session.readerMemberId) ?? null
            : null;
          if (isAnotherReader) {
            setOwnLiveSession(null);
            setLiveReader({
              sessionId: session.id,
              member: readerMember,
              label: session.readerLabel,
              startedAt: session.startedAt,
              slotEndsAt: session.slotEndsAt,
              // Keep the server's stored value here. Ang 0 is displayed as
              // Ang 1 in UI, but `startAng` is a protocol value used by
              // finish to prove which session this is.
              startAng: session.startAng,
              currentAng: displayReadingAng(session.currentAng),
            });
          } else {
            setLiveReader(null);
            setOwnLiveSession({
              sessionId: session.id,
              startAng: session.startAng,
              startedAt: session.startedAt,
              slotEndsAt: session.slotEndsAt,
            });
          }
        }
      };
      refreshLiveReader().catch(() => undefined);
      const interval = setInterval(() => {
        refreshLiveReader().catch(() => undefined);
      }, 10000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [members, sehajPathId])
  );

  /**
   * Continue's live card is a view of the reader's socket, not a second poll.
   * The REST current-session response tells us who is reading so the card can
   * appear quickly; this connection supplies the authoritative Ang and pixel
   * offset and keeps the preview moving while the reader scrolls.
   */
  useEffect(() => {
    const sessionId = liveReader?.sessionId;
    if (!sehajPathId || !sessionId || uiState.tabs !== 'progress') {
      setLivePreviewPosition(null);
      previewLiveRef.current?.close();
      previewLiveRef.current = null;
      return;
    }

    let cancelled = false;
    setLivePreviewPosition(null);
    previewLiveRef.current?.close();
    previewLiveRef.current = null;

    connectLive({
      sehajPathId,
      onJoined: (snapshot) => {
        if (cancelled) {
          return;
        }
        // A session can end and be replaced while this socket is opening. Do
        // not let an older joined snapshot move the new preview backwards.
        if (!snapshot || snapshot.sessionId !== sessionId) {
          setLivePreviewPosition(null);
          if (!snapshot) {
            setLiveReader((reader) => (reader?.sessionId === sessionId ? null : reader));
            setReadAlongAvailable(false);
          }
          return;
        }
        setLivePreviewPosition(snapshot);
        setLiveReader((reader) => {
          if (!reader || reader.sessionId !== snapshot.sessionId) {
            return reader;
          }
          return {
            ...reader,
            currentAng: displayReadingAng(snapshot.currentAng),
            label: snapshot.readerLabel ?? reader.label,
          };
        });
      },
      onPosition: (position) => {
        if (cancelled) {
          return;
        }
        // The transport joins a path room, so a delayed packet from an older
        // session can still arrive after a takeover. Sequence numbers order
        // packets within a session; this check rejects packets across sessions.
        const packetSessionId = (position as LivePosition & { sessionId?: unknown }).sessionId;
        if (typeof packetSessionId === 'string' && packetSessionId !== sessionId) {
          return;
        }
        setLivePreviewPosition(position);
        setLiveReader((reader) =>
          reader && reader.sessionId === sessionId
            ? displayReadingAng(position.currentAng) === reader.currentAng
              ? reader
              : { ...reader, currentAng: displayReadingAng(position.currentAng) }
            : reader
        );
      },
      onReadingEnded: (ended) => {
        if (!cancelled && ended.sessionId === sessionId) {
          setLivePreviewPosition(null);
          setLiveReader(null);
          setReadAlongAvailable(false);
        }
      },
      onEnded: () => {
        // Keep the REST-backed card during a transient network drop. The
        // existing focus poll will remove it only when the server confirms the
        // session has actually ended.
      },
    })
      .then((handle) => {
        if (cancelled) {
          handle.close();
          return;
        }
        previewLiveRef.current = handle;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      previewLiveRef.current?.close();
      previewLiveRef.current = null;
    };
  }, [liveReader?.sessionId, sehajPathId, uiState.tabs]);

  const loadUpcomingTurn = useCallback(async () => {
    if (sehajPathId === null || !isSharedPath) {
      setUpcomingTurn(null);
      setActiveOwnTurn(null);
      setScheduleSlots([]);
      setUpcomingTurnsLoading(false);
      return;
    }
    setUpcomingTurnsLoading(true);
    const now = new Date();
    const from = now;
    const to = addLocalDays(now, UPCOMING_TURN_LOOKAHEAD_DAYS);
    const result = await loadPlan(sehajPathId, from, to);
    if (!result.ok) {
      setUpcomingTurn(null);
      setActiveOwnTurn(null);
      setScheduleSlots([]);
      setUpcomingTurnsLoading(false);
      return;
    }
    setScheduleSlots(result.data.slots);
    const next = result.data.slots
      .filter((slot) => slot.status === 'SCHEDULED' && isAfter(slot.startsAt, now))
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
    setUpcomingTurn(next ?? null);
    setUpcomingTurnsLoading(false);
  }, [isSharedPath, sehajPathId]);

  useFocusEffect(
    useCallback(() => {
      loadUpcomingTurn().catch(() => {
        setUpcomingTurn(null);
        setActiveOwnTurn(null);
        setScheduleSlots([]);
        setUpcomingTurnsLoading(false);
      });
    }, [loadUpcomingTurn])
  );

  // A screen can remain open across a slot boundary. Re-evaluate the already
  // loaded plan locally so the action changes from Read along to Take your
  // turn at the exact start time without polling the API every second.
  useEffect(() => {
    const updateActiveOwnTurn = () => {
      const active = turnAt(scheduleSlots);
      setActiveOwnTurn(active?.isMine ? active : null);
    };
    updateActiveOwnTurn();
    const timer = setInterval(updateActiveOwnTurn, 1000);
    return () => clearInterval(timer);
  }, [scheduleSlots]);

  const liveReaderTime = liveReader === null ? '' : formatLiveReaderTime(liveReader);
  // A live session's checkpoint is the authoritative group position. The
  // local path value is only the fallback when nobody is currently reading.
  const previewAng = displayReadingAng(
    livePreviewPosition?.currentAng ?? liveReader?.currentAng ?? pathState.pathAng
  );
  const previewLiveSessionId = liveReader?.sessionId ?? null;
  const previewScrollPosition = Math.max(0, livePreviewPosition?.scrollPosition ?? 0);
  const upcomingTurnMember = upcomingTurn?.readerMemberId
    ? activeMembers.find((member) => member.id === upcomingTurn.readerMemberId)
    : undefined;
  let continueButtonText = Constants.CONTINUE;
  if (joining) {
    continueButtonText = Constants.OPENING_READER;
  } else if (activeOwnTurn !== null) {
    continueButtonText = Constants.TAKE_YOUR_TURN;
  } else if (readAlongAvailable) {
    continueButtonText = Constants.READ_ALONG;
  }

  useEffect(() => {
    if (uiState.tabs !== 'progress' || previewLiveSessionId === null || previewAng <= 0) {
      setPreviewLines([]);
      return;
    }
    let cancelled = false;
    // Do not show the previous Ang while the new Ang is being loaded. Keeping
    // it mounted makes the preview appear to jump backwards during a live move.
    setPreviewLines([]);
    getAngContent(previewAng).then((result) => {
      if (!cancelled && result.success && result.data) {
        // Keep the complete Ang in the clipped preview. The nested scroll view
        // is positioned from the live socket offset below, so the visible top
        // is the same area the reader is currently viewing instead of always
        // being the first four panktee.
        setPreviewLines(result.data.page.map((verse) => verse.verse.unicode));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [previewLiveSessionId, previewAng, uiState.tabs]);

  // ScrollView content is laid out asynchronously. Re-apply the socket offset
  // after the Ang has rendered and whenever a newer position packet arrives.
  useEffect(() => {
    if (!hasActiveSharedSession || previewLines.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      previewScrollRef.current?.scrollTo({ y: previewScrollPosition, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [hasActiveSharedSession, previewLines.length, previewScrollPosition, previewAng]);

  /** Show Turns, optionally placing the booking sheet above it. */
  const openTurns = useCallback(
    (canBook: boolean) => {
      setUiState((previous) => ({ ...previous, tabs: 'turns' }));
      if (canBook && sehajPathId !== null) {
        navigation.navigate(Routes.ChooseSlot, { sehajPathId, pathId });
      }
    },
    [navigation, pathId, sehajPathId]
  );

  /**
   * Open the reading.
   *
   * A personal path goes straight in, as it always has. A shared one has to
   * settle a question first: is somebody already reading? Whoever opens the
   * screen must arrive knowing which role they hold, because a follower that
   * briefly believes it is driving reports a position and moves the whole
   * group.
   */
  const handleContinue = useCallback(async () => {
    if (!sehajPathId) {
      navigation.push('Path', { pathId });
      return;
    }
    if (joining) {
      return;
    }
    setJoining(true);

    if (!readAlongAvailable && ownLiveSession !== null) {
      setJoining(false);
      navigation.push('Path', {
        pathId,
        live: {
          sehajPathId,
          driving: true,
          sessionId: ownLiveSession.sessionId,
          startAng: ownLiveSession.startAng,
          startedAt: ownLiveSession.startedAt,
          slotEndsAt: ownLiveSession.slotEndsAt,
        },
      });
      return;
    }

    if (readAlongAvailable) {
      trackSharedPathEvent(activeOwnTurn === null ? 'READ_ALONG' : 'TAKEOVER');
      // A booked member explicitly requesting Continue gets the server-side
      // hand-off. Members without an active slot receive a quick refusal and
      // continue as followers through the existing path below.
      const takeover = await takeoverReading(sehajPathId);
      if (takeover.ok) {
        setJoining(false);
        navigation.push('Path', {
          pathId,
          live: {
            sehajPathId,
            driving: true,
            sessionId: takeover.data.id,
            startAng: takeover.data.startAng,
            startedAt: takeover.data.startedAt,
            slotEndsAt: takeover.data.slotEndsAt,
          },
        });
        return;
      }
      // The live card may have become stale while the takeover request was in
      // flight. Re-read only on this failure path: if the old reader finished,
      // the caller should start a normal (possibly unscheduled) session rather
      // than entering a follower view of a session that no longer exists.
      const latest = await currentSession(sehajPathId);
      if (latest.ok && latest.data && isTurnStillLive(latest.data)) {
        setJoining(false);
        navigation.push('Path', {
          pathId,
          live: {
            sehajPathId,
            driving: false,
            sessionId: latest.data.id,
            startAng: latest.data.startAng,
            startedAt: latest.data.startedAt,
            slotEndsAt: latest.data.slotEndsAt,
          },
        });
        return;
      }
      const started = await startReading(sehajPathId);
      setJoining(false);
      if (started.ok) {
        navigation.push('Path', {
          pathId,
          live: {
            sehajPathId,
            driving: true,
            sessionId: started.data.id,
            startAng: started.data.startAng,
            startedAt: started.data.startedAt,
            slotEndsAt: started.data.slotEndsAt,
          },
        });
        return;
      }
      Alert.alert(Constants.READER_START_ERROR_TITLE, started.message);
      setReadAlongAvailable(false);
      return;
    }

    // Continue is a live-reading action, not a calendar permission check.
    // First resolve an existing session so this device enters as a follower;
    // otherwise ask the server to start a normal session. The server leaves
    // slotId null when no booked slot belongs to this member.
    const current = await currentSession(sehajPathId);

    const turn = current.ok ? current.data : null;

    if (turn !== null && isTurnStillLive(turn)) {
      setJoining(false);
      // The turn may already be THIS device's — a reader who backed out and
      // came back still holds it, and the server keeps it live through a grace
      // period. Resuming as the reader rather than following is the difference
      // between carrying on and being shown "Following <your own name>" over a
      // page you are supposed to be driving.
      // Resolved FRESH, not from state.
      //
      // `members` loads asynchronously, so a reader who pressed Continue before
      // it arrived matched nothing and was handed `driving: false` — made a
      // follower of their own turn. Both devices then believed they were
      // watching, nobody was driving, and the one that tried to share its
      // layout was refused for not holding the turn.
      //
      // The list is already cached by the request above in the common case;
      // paying for it here is worth not deciding the reader's role on a race.
      let loaded = members;
      if (loaded.length === 0) {
        const fetched = await listMembers(sehajPathId);
        loaded = fetched.ok ? fetched.data : [];
      }
      const mine = loaded.find((member) => member.isMine);
      const driving = mine !== undefined && turn.readerMemberId === mine.id;
      if (!driving) {
        const takeover = await takeoverReading(sehajPathId);
        if (takeover.ok) {
          setJoining(false);
          navigation.push('Path', {
            pathId,
            live: {
              sehajPathId,
              driving: true,
              sessionId: takeover.data.id,
              startAng: takeover.data.startAng,
              startedAt: takeover.data.startedAt,
              slotEndsAt: takeover.data.slotEndsAt,
            },
          });
          return;
        }
      }
      // A live session is already the authoritative destination. If it is
      // another member's session, enter as a follower; do not send the user
      // back to Turns and make them press Read Along again. If it is this
      // member's session, enter as the reader and resume it.
      setJoining(false);
      navigation.push('Path', {
        pathId,
        live: {
          sehajPathId,
          driving,
          sessionId: turn.id,
          startAng: turn.startAng,
          startedAt: turn.startedAt,
          slotEndsAt: turn.slotEndsAt,
        },
      });
      return;
    }

    const started = await startReading(sehajPathId);
    setJoining(false);

    if (started.ok) {
      navigation.push('Path', {
        pathId,
        live: {
          sehajPathId,
          driving: true,
          sessionId: started.data.id,
          startAng: started.data.startAng,
          startedAt: started.data.startedAt,
          slotEndsAt: started.data.slotEndsAt,
        },
      });
      return;
    }

    // A live session may have appeared between the current-session request and
    // start. Re-read it once and enter as a follower instead of treating the
    // normal race as a booking failure.
    const latest = await currentSession(sehajPathId);
    if (latest.ok && latest.data && isTurnStillLive(latest.data)) {
      setJoining(false);
      navigation.push('Path', {
        pathId,
        live: {
          sehajPathId,
          driving: false,
          sessionId: latest.data.id,
          startAng: latest.data.startAng,
          startedAt: latest.data.startedAt,
          slotEndsAt: latest.data.slotEndsAt,
        },
      });
      return;
    }

    Alert.alert(Constants.READER_START_ERROR_TITLE, started.message);
  }, [
    navigation,
    pathId,
    sehajPathId,
    joining,
    members,
    readAlongAvailable,
    activeOwnTurn,
    ownLiveSession,
  ]);

  const handleLoginRequired = useCallback(() => {
    Alert.alert(Constants.LOGIN_REQUIRED_TITLE, Constants.LOGIN_REQUIRED_MESSAGE, [
      { text: Constants.CANCEL, style: 'cancel' },
      {
        text: Constants.LOGIN,
        onPress: () => {
          startLogin().catch((error: unknown) => {
            recordError(error, 'Continue: login from protected tab failed');
          });
        },
      },
    ]);
  }, []);

  useEffect(
    () => () => {
      if (loginPromptTimeoutRef.current !== null) {
        clearTimeout(loginPromptTimeoutRef.current);
        loginPromptTimeoutRef.current = null;
      }
    },
    []
  );

  const handleTabPress = useCallback(
    (tab: 'progress' | 'streak' | 'turns' | 'members') => {
      if (!isSignedIn && tab === 'turns') {
        // Keep the short delay so a tab tap has settled before presenting the
        // native alert, avoiding a pressed-tab animation underneath it.
        if (loginPromptTimeoutRef.current !== null) {
          clearTimeout(loginPromptTimeoutRef.current);
        }
        loginPromptTimeoutRef.current = setTimeout(() => {
          loginPromptTimeoutRef.current = null;
          handleLoginRequired();
        }, 1000);
        return;
      }
      trackEvent('TabSwitch', 'click', `switch to ${tab} tab`);
      setUiState((prev) => ({ ...prev, tabs: tab }));
    },
    [handleLoginRequired, isSignedIn]
  );

  const handlePathRenamePress = useCallback(() => {
    if (!canManagePath) {
      return;
    }
    setUiState((prev) => ({ ...prev, showPathRename: true }));
  }, [canManagePath]);

  const performLeavePath = useCallback(() => {
    if (sehajPathId === null) {
      return;
    }
    const mine = activeMembers.find((member) => member.isMine);
    if (!mine) {
      return;
    }
    trackSharedPathEvent('MEMBER_LEAVE');
    leavePath(sehajPathId, mine.id)
      .then((result) => {
        if (result.ok) {
          // Home already exists below Continue in the normal flow. Replacing
          // Continue would create another Home and retain the stale stack.
          navigation.popTo(Routes.Home);
          return;
        }
        showErrorAlert(result.message);
      })
      .catch((error: unknown) => {
        recordError(error, 'Continue: leave path failed');
        showErrorAlert(ErrorConstants.FAILED_TO_LEAVE_PATH);
      });
  }, [activeMembers, navigation, sehajPathId]);

  const handleLeavePath = useCallback(() => {
    if (sehajPathId === null) {
      return;
    }
    const mine = activeMembers.find((member) => member.isMine);
    if (!mine) {
      return;
    }
    if (mine.role === 'ADMIN' && isLastActiveAdmin) {
      Alert.alert(Constants.LEAVE_PATH_ADMIN_TITLE, Constants.LEAVE_PATH_ADMIN_MESSAGE, [
        { text: Constants.CANCEL, style: 'cancel' },
        {
          text: Constants.MAKE_AN_ADMIN,
          onPress: () => handleTabPress('members'),
        },
      ]);
      return;
    }
    Alert.alert(Constants.LEAVE_PATH_TITLE, Constants.LEAVE_PATH_MESSAGE, [
      { text: Constants.CANCEL, style: 'cancel' },
      {
        text: Constants.LEAVE_PATH,
        style: 'destructive',
        onPress: performLeavePath,
      },
    ]);
  }, [activeMembers, handleTabPress, isLastActiveAdmin, performLeavePath, sehajPathId]);

  const handleMakeAdmin = useCallback(
    async (member: SehajPathMember) => {
      if (sehajPathId === null) {
        return;
      }
      trackSharedPathEvent('MEMBER_MAKE_ADMIN');
      try {
        const result = await makeMemberAdmin(sehajPathId, member.id);
        if (result.ok) {
          await loadMembers();
        } else {
          showErrorAlert(result.message);
        }
      } catch (error: unknown) {
        recordError(error, 'Continue: make member admin failed');
        showErrorAlert(ErrorConstants.FAILED_TO_UPDATE_MEMBER_ROLE);
      }
    },
    [loadMembers, sehajPathId]
  );

  const handleToggleAdmin = useCallback(
    async (member: SehajPathMember) => {
      if (sehajPathId === null) {
        return;
      }
      trackSharedPathEvent(member.role === 'ADMIN' ? 'MEMBER_REMOVE_ADMIN' : 'MEMBER_MAKE_ADMIN');
      try {
        const result = await setMemberAdmin(sehajPathId, member.id, member.role !== 'ADMIN');
        if (result.ok) {
          // The role endpoint returns the changed membership. Use it straight
          // away so the Admin label and available actions do not wait for a
          // second members-list request to complete.
          setMembers((current) =>
            current.map((entry) => (entry.id === member.id ? result.data : entry))
          );
          loadMembers().catch((error: unknown) => {
            recordError(error, 'Continue: refresh members after role update failed');
          });
        } else {
          showErrorAlert(result.message);
        }
      } catch (error: unknown) {
        recordError(error, 'Continue: update member role failed');
        showErrorAlert(ErrorConstants.FAILED_TO_UPDATE_MEMBER_ROLE);
      }
    },
    [loadMembers, sehajPathId]
  );

  const handleRemoveMember = useCallback(
    (member: SehajPathMember) => {
      if (sehajPathId === null) {
        return;
      }
      Alert.alert('Remove member?', `${member.displayLabel} will leave this path.`, [
        { text: Constants.CANCEL, style: 'cancel' },
        {
          text: 'Remove member',
          style: 'destructive',
          onPress: () => {
            trackSharedPathEvent('MEMBER_REMOVE');
            removeMember(sehajPathId, member.id)
              .then((result) => {
                if (result.ok) {
                  loadMembers().catch((error: unknown) => {
                    recordError(error, 'Continue: failed to refresh members after removal');
                  });
                  return;
                }
                showErrorAlert(result.message);
              })
              .catch((error: unknown) => {
                recordError(error, 'Continue: remove member failed');
                showErrorAlert(ErrorConstants.FAILED_TO_REMOVE_MEMBER);
              });
          },
        },
      ]);
    },
    [loadMembers, sehajPathId]
  );

  const handleBackPress = useCallback(() => {
    if (isFromPath) {
      navigation.goBack();
      return;
    }

    navigation.popTo(Routes.Home);
  }, [navigation, isFromPath]);

  const progressText = useMemo(
    () => [
      Constants.YOU_ARE_ON_ANG_NUMBER,
      <ImportantText
        key="ang"
        importantText={`${pathState.pathAng}`}
        importantTextStyles={ContinueScreenStyles.impTextContainer}
      />,
      Constants.HAVE_COMPLETED,
      <ImportantText
        key="percentage"
        importantText={`${pathState.pathPercentage}%`}
        importantTextStyles={ContinueScreenStyles.impTextContainer}
      />,
      Constants.SRI_SEHAJ_PATH,
    ],
    [pathState.pathAng, pathState.pathPercentage]
  );

  const completionText = useMemo(
    () => [
      Constants.STARTED_PATH,
      <ImportantText key="days" importantText={`${pathState.daysAgo} days `} />,
      Constants.AVERAGE_ABOUT,
      <ImportantText key="average" importantText={`${pathState.averageAngs} angs a day. `} />,
      Constants.COMPLETION_SEHAJ_PATH,
      <ImportantText key="finish" importantText={`${pathState.finishDate} 🎯 .`} />,
    ],
    [pathState.daysAgo, pathState.averageAngs, pathState.finishDate]
  );
  return (
    <SafeAreaView style={SafeAreaStyle.safeAreaView} edges={EDGES_ALL_SIDES}>
      <ImageBackground
        source={ContinueScreenBackground}
        style={ContinueScreenStyles.backgroundImage}
      >
        <ScrollView
          contentContainerStyle={ContinueScreenStyles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={ContinueScreenStyles.container}>
            <View style={ContinueScreenStyles.navRow}>
              <BackButton
                style={ContinueScreenStyles.navContainer}
                onPress={handleBackPress}
                accessibilityLabel={isFromPath ? Constants.BACK_TO_PATH : 'Back to home'}
                accessibilityHint={
                  isFromPath ? 'Tap to go back to the path screen' : 'Tap to go back to home screen'
                }
              >
                <NavContent text={isFromPath ? Constants.BACK_TO_PATH : Constants.HOME} />
              </BackButton>
              {matchedPath && canManagePath ? (
                <PathOptionsMenu
                  pathId={pathId}
                  pathName={pathState.pathName || pathState.pathData?.pathName || ''}
                  onLeave={sehajPathId !== null ? performLeavePath : undefined}
                  leaveRequiresAdminTransfer={isLastActiveAdmin}
                  onMakeAdmin={() => handleTabPress('members')}
                  onDeleted={() => navigation.popTo(Routes.Home, { pathDeleted: true })}
                  onDeletingChange={(deleting) => {
                    isDeletingRef.current = deleting;
                  }}
                />
              ) : null}
            </View>
            <View style={ContinueScreenStyles.tabsContainer}>
              <Pressable
                style={uiState.tabs === 'progress' ? ContinueScreenStyles.tabActive : null}
                onPress={() => handleTabPress('progress')}
                onLongPress={() => handleTabPress('progress')}
                accessibilityLabel="Progress tab"
                accessibilityRole="tab"
                accessibilityState={{ selected: uiState.tabs === 'progress' }}
                accessibilityHint="Tap to view progress information"
              >
                <Text
                  style={[
                    ContinueScreenStyles.tabText,
                    uiState.tabs === 'progress'
                      ? ContinueScreenStyles.tabTextActive
                      : ContinueScreenStyles.tabTextInactive,
                  ]}
                >
                  {Constants.PROGRESS_TAB}
                </Text>
              </Pressable>
              <Pressable
                style={uiState.tabs === 'streak' ? ContinueScreenStyles.tabActive : null}
                onPress={() => handleTabPress('streak')}
                onLongPress={() => handleTabPress('streak')}
                accessibilityLabel="Streak tab"
                accessibilityRole="tab"
                accessibilityState={{ selected: uiState.tabs === 'streak' }}
                accessibilityHint="Tap to view streak information"
              >
                <Text
                  style={[
                    ContinueScreenStyles.tabText,
                    uiState.tabs === 'streak'
                      ? ContinueScreenStyles.tabTextActive
                      : ContinueScreenStyles.tabTextInactive,
                  ]}
                >
                  {Constants.STREAKS_TAB}
                </Text>
              </Pressable>
              {showTurnsTab && (
                <Pressable
                  style={uiState.tabs === 'turns' ? ContinueScreenStyles.tabActive : null}
                  onPress={() => handleTabPress('turns')}
                  onLongPress={() => handleTabPress('turns')}
                  accessibilityLabel="Turns tab"
                  accessibilityRole="tab"
                  accessibilityState={{ selected: uiState.tabs === 'turns' }}
                  accessibilityHint="Tap to view the reading turns"
                >
                  <Text
                    style={[
                      ContinueScreenStyles.tabText,
                      uiState.tabs === 'turns'
                        ? ContinueScreenStyles.tabTextActive
                        : ContinueScreenStyles.tabTextInactive,
                    ]}
                  >
                    {Constants.TURNS_TAB}
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={uiState.tabs === 'members' ? ContinueScreenStyles.tabActive : null}
                onPress={() => handleTabPress('members')}
                onLongPress={() => handleTabPress('members')}
                accessibilityLabel="Members tab"
                accessibilityRole="tab"
                accessibilityState={{ selected: uiState.tabs === 'members' }}
                accessibilityHint="Tap to view the path members"
              >
                <Text
                  style={[
                    ContinueScreenStyles.tabText,
                    uiState.tabs === 'members'
                      ? ContinueScreenStyles.tabTextActive
                      : ContinueScreenStyles.tabTextInactive,
                  ]}
                >
                  {Constants.MEMBERS_TAB}
                </Text>
              </Pressable>
            </View>
            {uiState.tabs === 'progress' && (
              <>
                <Pressable
                  style={ContinueScreenStyles.sehajHeadingContainer}
                  onPress={handlePathRenamePress}
                  onLongPress={handlePathRenamePress}
                  accessibilityLabel={`Path name: ${
                    pathState.pathName || pathState.pathData?.pathName
                  }`}
                  accessibilityRole="button"
                  accessibilityHint={canManagePath ? 'Tap to rename this path' : undefined}
                >
                  <SecondaryHeading
                    text={pathState.pathName || pathState.pathData?.pathName || ''}
                    textStyles={ContinueScreenStyles.sehajHeading}
                  />
                </Pressable>
                <ImportantText
                  importantText={Constants.WAHEGURU_JI_KA_KHALSA_WAHEGURU_JI_KI_FATEH}
                  importantTextStyles={ContinueScreenStyles.waheguruHeading}
                />
                {hasActiveSharedSession && (
                  <View style={ContinueScreenStyles.liveReaderCard}>
                    {liveReader.member && avatarUrlFor(sehajPathId, liveReader.member) ? (
                      <Image
                        source={{
                          uri: avatarUrlFor(sehajPathId, liveReader.member) as string,
                          headers: avatarHeaders(),
                        }}
                        style={ContinueScreenStyles.liveReaderAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          ContinueScreenStyles.liveReaderAvatar,
                          ContinueScreenStyles.liveReaderFallback,
                        ]}
                      >
                        <Text style={ContinueScreenStyles.liveReaderInitial}>
                          {initialOf(liveReader.label)}
                        </Text>
                      </View>
                    )}
                    <View style={ContinueScreenStyles.liveReaderCopy}>
                      <Text style={ContinueScreenStyles.liveReaderName} numberOfLines={1}>
                        {liveReader.label} is Reading
                      </Text>
                      <Text style={ContinueScreenStyles.liveReaderTime}>{liveReaderTime}</Text>
                    </View>
                    <View style={ContinueScreenStyles.liveBadge}>
                      <Text style={ContinueScreenStyles.liveBadgeText}>● LIVE</Text>
                    </View>
                  </View>
                )}
                {hasActiveSharedSession && previewLines.length > 0 && (
                  <>
                    <View style={ContinueScreenStyles.previewCard}>
                      <ScrollView
                        ref={previewScrollRef}
                        scrollEnabled={false}
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => {
                          previewScrollRef.current?.scrollTo({
                            y: previewScrollPosition,
                            animated: false,
                          });
                        }}
                      >
                        {previewLines.map((line, index) => (
                          <Text
                            key={`${previewAng}-${index}`}
                            style={ContinueScreenStyles.previewLine}
                          >
                            {line}
                          </Text>
                        ))}
                      </ScrollView>
                    </View>
                  </>
                )}
                {hasActiveSharedSession && (
                  <Text style={ContinueScreenStyles.liveReaderAng}>
                    {/* The socket position wins over the REST session snapshot. */}
                    Ang {previewAng}
                  </Text>
                )}
              </>
            )}

            {uiState.tabs === 'progress' && hasActiveSharedSession && (
              <SecondaryButton
                onPress={handleContinue}
                buttonText={continueButtonText}
                buttonIcon={<ContinueIcon />}
                buttonStyle={ContinueScreenStyles.continueButton}
                buttonIconStyle={ContinueScreenStyles.continueButtonIcon}
              />
            )}

            {pathState.showData ? (
              <>
                {uiState.tabs === 'progress' && (
                  <>
                    <SimpleText
                      simpleText={progressText}
                      simpleTextStyle={ContinueScreenStyles.textStyle}
                    />
                    <SimpleText simpleText={completionText} />
                  </>
                )}
                {uiState.tabs === 'streak' && (
                  <>
                    <View style={ContinueScreenStyles.streakContainer}>
                      <View style={ContinueScreenStyles.streakValueContainer}>
                        {uiState.streakValue === null ? (
                          <ActivityIndicator color={UIConstants.PRIMARY_COLOR} />
                        ) : (
                          <SecondaryHeading
                            text={uiState.streakValue.toString()}
                            textStyles={ContinueScreenStyles.streakText}
                          />
                        )}
                        <Image
                          source={require('@assets/Images/Streak.png')}
                          style={ContinueScreenStyles.streakIcon}
                        />
                      </View>
                      <Text style={ContinueScreenStyles.streakTagLine}>Current Streak</Text>
                    </View>
                    <Calender
                      pathId={pathId}
                      sharedPathId={sehajPathId ?? undefined}
                      streak={streak}
                      onStreakUpdate={handleStreakUpdate}
                    />
                    <SecondaryButton
                      onPress={handleContinue}
                      buttonText={continueButtonText}
                      buttonIcon={<ContinueIcon />}
                      buttonStyle={ContinueScreenStyles.continueButton}
                      buttonIconStyle={ContinueScreenStyles.continueButtonIcon}
                    />
                  </>
                )}
              </>
            ) : (
              // The ten-ang gate is about PROGRESS statistics — an average and a
              // projected finish date mean nothing from a standing start. It is
              // not a gate on the path itself, so the schedule is rendered
              // outside it: whose turn it is has nothing to do with how far
              // anybody has read, and a group booking its first turns has read
              // nothing yet by definition.
              uiState.tabs !== 'turns' &&
              uiState.tabs !== 'members' && (
                <Text style={ContinueScreenStyles.complete10Angs}>
                  {Constants.COMPLETE_10_ANGS}
                </Text>
              )
            )}

            {uiState.tabs === 'progress' && liveReader === null && (
              <SecondaryButton
                onPress={handleContinue}
                buttonText={continueButtonText}
                buttonIcon={<ContinueIcon />}
                buttonStyle={ContinueScreenStyles.continueButton}
                buttonIconStyle={ContinueScreenStyles.continueButtonIcon}
              />
            )}

            {showTurnsContent && (
              <TurnsTab
                sehajPathId={sehajPathId}
                members={membersForDisplay}
                avatarUriFor={(member) => avatarUrlFor(sehajPathId, member)}
                onBookSlot={(startsAt) =>
                  navigation.navigate(Routes.ChooseSlot, {
                    sehajPathId,
                    pathId,
                    ...(startsAt ? { initialStartsAt: startsAt.toISOString() } : {}),
                  })
                }
                onFollow={() => {
                  trackSharedPathEvent('READ_ALONG');
                  navigation.push('Path', { pathId, live: { sehajPathId, driving: false } });
                }}
                onCancelSlot={async (slot) => {
                  trackSharedPathEvent('TURN_DELETE');
                  const result = await cancelSlot(sehajPathId, slot.id);
                  if (!result.ok) {
                    showErrorAlert(result.message);
                  }
                }}
                onEditSlot={(slot) =>
                  navigation.navigate(Routes.ChooseSlot, {
                    sehajPathId,
                    pathId,
                    slotId: slot.id,
                    initialStartsAt: slot.startsAt,
                    initialDurationMinutes: Math.max(
                      15,
                      Math.round(differenceInMinutes(slot.endsAt, slot.startsAt))
                    ),
                  })
                }
                canManageSlots={canManagePath}
              />
            )}

            {showUpcomingTurns && (
              <View style={ContinueScreenStyles.upcomingTurnSection}>
                <Text style={ContinueScreenStyles.upcomingTurnTitle}>Upcoming turns</Text>
                {upcomingTurnsLoading ? (
                  <View style={ContinueScreenStyles.upcomingTurnLoading}>
                    <ActivityIndicator color={ContinueScreenStyles.upcomingTurnTitle.color} />
                    <Text style={ContinueScreenStyles.noUpcomingTurns}>
                      {Constants.LOADING_TURNS}
                    </Text>
                  </View>
                ) : upcomingTurn ? (
                  <View style={ContinueScreenStyles.upcomingTurnCard}>
                    <Text style={ContinueScreenStyles.upcomingTurnDay}>Upcoming</Text>
                    <Text style={ContinueScreenStyles.upcomingTurnTime}>
                      {dayjs(upcomingTurn.startsAt).format('h:mm A')} -{' '}
                      {dayjs(upcomingTurn.endsAt).format('h:mm A')}
                    </Text>
                    <Text style={ContinueScreenStyles.upcomingTurnReader}>
                      {upcomingTurnMember?.displayLabel ?? upcomingTurn.readerLabel}
                    </Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => openTurns(true)}
                    accessibilityRole="button"
                    accessibilityLabel={`${Constants.NO_UPCOMING_SLOTS} ${Constants.ADD_TURN}`}
                  >
                    <Text style={ContinueScreenStyles.noUpcomingTurns}>
                      {Constants.NO_UPCOMING_SLOTS}{' '}
                      <Text style={ContinueScreenStyles.addTurnLink}>{Constants.ADD_TURN}</Text>
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Sits below the reading action, matching where the group belongs
                in the hierarchy: the path first, the people around it second. */}
            {uiState.tabs === 'members' && (
              <MembersRow
                members={membersForDisplay}
                membersError={membersError}
                onRetryMembers={() => {
                  loadMembers().catch((error: unknown) => {
                    recordError(error, 'Continue: retry loading members failed');
                  });
                }}
                avatarUriFor={
                  invitableId ? (member) => avatarUrlFor(invitableId, member) : undefined
                }
                onAdd={() => {
                  if (invitableId !== null) {
                    setSuggestedMembersOpen(true);
                  }
                }}
                onShare={handleSharePath}
                inviteStatus={inviteStatus}
                inviteExpiryHours={inviteExpiryHours}
                onInviteExpiryChange={setInviteExpiryHours}
                onCreateInvite={handleCreateInvite}
                onLeave={sehajPathId !== null ? handleLeavePath : undefined}
                canManageMembers={canManagePath || !isSignedIn}
                showActions={invitableId !== null || sehajPathId === null}
                onMakeAdmin={handleMakeAdmin}
                onToggleAdmin={handleToggleAdmin}
                onRemoveMember={handleRemoveMember}
              />
            )}

            {showMemberSummary && (
              <Pressable
                style={ContinueScreenStyles.memberSummary}
                onPress={() => handleTabPress('members')}
                accessibilityRole="button"
                accessibilityLabel={`This Sehaj Path is being done by ${activeMembers.length} people`}
              >
                <Text style={ContinueScreenStyles.memberSummaryText}>
                  This Sehaj Path is being done by{' '}
                  <Text style={ContinueScreenStyles.memberSummaryCount}>
                    {activeMembers.length} people
                  </Text>
                  .
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </ImageBackground>
      {invitableId !== null && inviteOpen && (
        <InviteSheet
          visible={inviteOpen}
          sehajPathId={invitableId}
          onClose={() => {
            setInviteOpen(false);
            setInviteAutoCreate(false);
          }}
          onShared={() => {
            loadMembers().catch(() => undefined);
            loadInviteStatus().catch(() => setInviteStatus('unknown'));
          }}
          onCreated={() => {
            // Invalidate any status request started while the sheet was
            // opening, then update the action synchronously for the close-
            // sheet path. A later focus refresh can still verify the server.
            inviteStatusLoadVersionRef.current += 1;
            setInviteStatus('active');
            loadMembers().catch(() => undefined);
          }}
          autoCreate={inviteAutoCreate}
          initialExpiryHours={inviteExpiryHours}
        />
      )}
      {isSignedIn && invitableId !== null && (
        <SuggestedMembersSheet
          visible={suggestedMembersOpen}
          sehajPathId={invitableId}
          existingMembers={activeMembers}
          onClose={() => setSuggestedMembersOpen(false)}
          onAdded={loadMembers}
        />
      )}
      {uiState.showPathRename && canManagePath && (
        <PathRename
          pathId={pathId}
          setPathRename={(show) => setUiState((prev) => ({ ...prev, showPathRename: show }))}
          setPathName={(name) => setPathState((prev) => ({ ...prev, pathName: name }))}
        />
      )}
    </SafeAreaView>
  );
};
