import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText as Text } from '../components/AppText';
import { MemberAvatars } from '../components/MemberAvatars';
import { GroupPathStyles as styles } from '@styles';
import { Routes } from '@constants';
import { currentSession, listMembers, startReading } from '../store/groupApi';
import { connectLive, type LiveHandle, type LivePosition } from '../store/liveSession';
import type { SehajPathMember, SehajPathSession } from '@api/generated/types.gen';
import type { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { trackSharedPathEvent } from '../utils/sharedPathAnalytics';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupPath'>;

/**
 * The group's view of a shared path: who is in it, who is reading, and the way
 * in to every group action.
 *
 * Separate from `PathScreen` on purpose. That screen renders scripture for one
 * person reading alone and owns a large amount of local-first machinery; this
 * one is about the group around the reading. Mixing them would put two
 * different ownership models — the device's, and the server's — in one file.
 *
 * The live connection lives here rather than in the reading screen because a
 * follower needs to know somebody started reading BEFORE they open anything.
 */

export const GroupPath = ({ route, navigation }: Props) => {
  const { sehajPathId, pathId, pathName } = route.params;
  useScreenAnalytics('GroupPath', 'GroupPath');

  const [members, setMembers] = useState<SehajPathMember[] | null>(null);
  const [session, setSession] = useState<SehajPathSession | null>(null);
  /** Where the reader is right now, from the socket. Null until one arrives. */
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [readerLabel, setReaderLabel] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [connection, setConnection] = useState<'live' | 'dropped' | 'refused' | null>(null);

  /** Held in a ref so the cleanup closes the socket that is actually open. */
  const live = useRef<LiveHandle | null>(null);

  const load = useCallback(async () => {
    const [memberResult, sessionResult] = await Promise.all([
      listMembers(sehajPathId),
      currentSession(sehajPathId),
    ]);

    setMembers(memberResult.ok ? memberResult.data : []);
    if (sessionResult.ok) {
      setSession(sessionResult.data);
    }
  }, [sehajPathId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  /**
   * One socket for as long as this screen is mounted.
   *
   * Opened even when nobody is reading: the whole point is to find out the
   * moment somebody starts, which is exactly when there is no session to poll
   * for.
   */
  useEffect(() => {
    let cancelled = false;

    connectLive({
      sehajPathId,
      onJoined: (snapshot) => {
        if (cancelled) {
          return;
        }
        setConnection('live');
        if (snapshot) {
          setReaderLabel(snapshot.readerLabel);
          setPosition(snapshot);
        }
      },
      onPosition: (next) => {
        if (!cancelled) {
          setPosition(next);
        }
      },
      onEnded: (reason) => {
        if (!cancelled) {
          setConnection(reason);
        }
      },
    })
      .then((handle) => {
        if (cancelled) {
          // Mounted and unmounted before the socket opened. Close it rather than
          // leaking a connection nothing is listening to.
          handle.close();
          return;
        }
        live.current = handle;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      live.current?.close();
      live.current = null;
    };
  }, [sehajPathId]);

  const begin = useCallback(async () => {
    if (starting) {
      return;
    }
    setStarting(true);
    setProblem(null);

    const result = await startReading(sehajPathId);
    setStarting(false);

    if (result.ok) {
      setSession(result.data);
      navigation.navigate(Routes.Path, {
        pathId,
        live: {
          sehajPathId,
          driving: true,
          sessionId: result.data.id,
          startAng: result.data.startAng,
          startedAt: result.data.startedAt,
          slotEndsAt: result.data.slotEndsAt,
        },
      });
      return;
    }

    // 409 means somebody else holds the turn. Not an error — refresh so the
    // screen shows who, and offer to follow instead.
    setProblem(result.message);
    if (result.kind === 'refused' && result.status === 409) {
      load().catch(() => undefined);
    }
  }, [sehajPathId, pathId, starting, navigation, load]);

  const active = (members ?? []).filter((member) => member.status === 'ACTIVE');
  const somebodyReading = session?.status === 'LIVE';

  if (members === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{pathName}</Text>

        <View style={styles.membersRow}>
          <MemberAvatars members={active} />
          <Text style={styles.membersCount}>
            {active.length === 1 ? 'Just you so far' : `${active.length} reading together`}
          </Text>
          <TouchableOpacity
            style={styles.add}
            onPress={() => navigation.navigate(Routes.InviteMember, { sehajPathId, pathName })}
            accessibilityRole="button"
            accessibilityLabel="Invite a member"
          >
            <Text style={styles.addText}>+</Text>
          </TouchableOpacity>
        </View>

        {problem !== null && <Text style={styles.problem}>{problem}</Text>}

        {/* Only worth saying when it changes what the reader can trust. A
            healthy connection needs no announcement. */}
        {connection === 'dropped' && (
          <Text style={styles.warning}>
            Reconnecting… you may not see the reader move until this clears.
          </Text>
        )}
        {connection === 'refused' && (
          <Text style={styles.warning}>You’re not connected to this path’s live reading.</Text>
        )}

        {somebodyReading ? (
          <View style={styles.liveCard}>
            <Text style={styles.liveLabel}>Reading now</Text>
            <Text style={styles.liveReader}>
              {readerLabel ?? session?.readerLabel ?? 'Someone'}
            </Text>
            <Text style={styles.liveAng}>
              {position ? `Ang ${position.currentAng}` : `Ang ${session?.currentAng ?? '—'}`}
            </Text>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => {
                trackSharedPathEvent('READ_ALONG');
                navigation.navigate(Routes.Path, {
                  pathId,
                  live: { sehajPathId, driving: false },
                });
              }}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Follow along</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.primary, starting && styles.disabled]}
            onPress={begin}
            disabled={starting}
            accessibilityRole="button"
            accessibilityState={{ disabled: starting }}
          >
            <Text style={styles.primaryText}>{starting ? 'Starting…' : 'Start reading'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondary}
          onPress={() => navigation.navigate(Routes.ChooseSlot, { sehajPathId, pathId })}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryText}>Book a slot</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
