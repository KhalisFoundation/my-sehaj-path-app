import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText as Text } from '../components/AppText';
import { JoinPathStyles as styles } from '@styles';
import { Constants, ErrorConstants, Routes } from '@constants';
import { joinInvite, resolveInvite, resolveInvitePreview } from '../store/groupApi';
import { startLogin } from '@auth';
import { useAppSelector } from '../store/hooks';
import { trackSharedPathEvent } from '../utils/sharedPathAnalytics';
import { showErrorAlert } from '../utils/Error';
import type { RootStackParamList } from '../App';
import { useScreenAnalytics } from '@hooks';
import { refreshPathsFromServer } from '../store/applyServerResponse';
import { store } from '../store';
import { selectVisiblePaths } from '../store/selectors';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinPath'>;

type Stage =
  | { name: 'loading' }
  | { name: 'ready'; pathName: string; memberCount: number }
  | { name: 'joining'; pathName: string; memberCount: number }
  | { name: 'member'; pathName: string }
  | { name: 'signed-out'; pathName?: string; memberCount?: number }
  | { name: 'dead'; message: string };

/** Shows the invite details before a reader confirms their direct join. */
export const JoinPath = ({ route, navigation }: Props) => {
  const { token } = route.params;
  useScreenAnalytics('JoinPath', 'JoinPath');
  const [stage, setStage] = useState<Stage>({ name: 'loading' });
  const authStatus = useAppSelector((state) => state.auth.status);

  const goHome = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: Routes.Home }] });
  }, [navigation]);

  /**
   * A joined path is owned by another account, so it is allocated locally by
   * the authenticated accessible-path refresh. Resolve that local id before
   * opening Continue; otherwise the invite screen would join successfully but
   * have no path id with which to render the progress tab.
   */
  const openJoinedPath = useCallback(
    async (pathName: string): Promise<boolean> => {
      const beforeIds = new Set(store.getState().paths.paths.map((path) => path.pathId));
      try {
        await refreshPathsFromServer(store, undefined, false);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_OPEN_SHARED_PATH);
        return false;
      }

      const state = store.getState();
      const visible = selectVisiblePaths(state);
      const sharedMatches = visible.filter(
        (path) => path.pathName === pathName && state.sync.meta[path.pathId]?.shared === true
      );
      const path =
        sharedMatches.find((candidate) => !beforeIds.has(candidate.pathId)) ?? sharedMatches[0];
      if (!path) {
        showErrorAlert(ErrorConstants.FAILED_TO_OPEN_SHARED_PATH);
        return false;
      }

      navigation.replace(Routes.Continue, { pathId: path.pathId, initialTab: 'progress' });
      return true;
    },
    [navigation]
  );

  const load = useCallback(async () => {
    if (authStatus === 'unknown') {
      return;
    }
    setStage({ name: 'loading' });
    const preview =
      authStatus === 'signedIn' ? await resolveInvite(token) : await resolveInvitePreview(token);
    if (!preview.ok) {
      setStage(
        preview.kind === 'signed-out'
          ? { name: 'signed-out' }
          : { name: 'dead', message: preview.message }
      );
      return;
    }

    // A public preview can show the path before sign-in, but joining itself
    // cannot. Do not first offer Join Now only to replace it with Sign in after
    // the tap — the receiver should have one clear flow: Sign in → Join Now.
    if (authStatus !== 'signedIn') {
      setStage({
        name: 'signed-out',
        pathName: preview.data.name,
        memberCount: preview.data.memberCount,
      });
      return;
    }

    if (preview.data.membership === 'ACTIVE') {
      setStage({ name: 'member', pathName: preview.data.name });
      return;
    }

    setStage({
      name: 'ready',
      pathName: preview.data.name,
      memberCount: preview.data.memberCount,
    });
  }, [authStatus, token]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const join = useCallback(async () => {
    if (stage.name !== 'ready') {
      return;
    }
    if (authStatus !== 'signedIn') {
      setStage({
        name: 'signed-out',
        pathName: stage.pathName,
        memberCount: stage.memberCount,
      });
      return;
    }

    setStage({ name: 'joining', pathName: stage.pathName, memberCount: stage.memberCount });
    trackSharedPathEvent('JOIN');
    const result = await joinInvite(token);
    if (result.ok) {
      setStage({ name: 'member', pathName: stage.pathName });
      await openJoinedPath(stage.pathName);
      return;
    }
    if (result.kind === 'signed-out') {
      setStage({
        name: 'signed-out',
        pathName: stage.pathName,
        memberCount: stage.memberCount,
      });
    } else {
      showErrorAlert(result.message);
      setStage({ name: 'dead', message: result.message });
    }
  }, [authStatus, openJoinedPath, stage, token]);

  const signIn = useCallback(async () => {
    try {
      await startLogin();
      // Auth state changes after the SSO callback. The `load` effect above is
      // keyed to that state, so it will refresh this invite with authenticated
      // membership and show Join Now exactly once.
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_OPEN_SHARED_PATH);
    }
  }, []);

  if (stage.name === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.body}>Opening this Sehaj Path…</Text>
      </View>
    );
  }

  if (stage.name === 'signed-out') {
    const inviteDetails =
      stage.pathName === undefined
        ? null
        : Constants.INVITE_MEMBER_COUNT.replace('{count}', String(stage.memberCount ?? 0));
    return (
      <View style={styles.centered}>
        <Text style={styles.eyebrow}>{Constants.INVITE_ACCEPT_EYEBROW}</Text>
        {stage.pathName !== undefined && <Text style={styles.title}>{stage.pathName}</Text>}
        {inviteDetails !== null && <Text style={styles.body}>{inviteDetails}</Text>}
        <Text style={styles.title}>Sign in to join</Text>
        <Text style={styles.body}>
          Reading together needs an account, so the group knows who is reading. Your invite stays
          valid.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={signIn} accessibilityRole="button">
          <Text style={styles.primaryText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={goHome} accessibilityRole="button">
          <Text style={styles.secondaryText}>Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage.name === 'member') {
    return (
      <View style={styles.centered}>
        <Text style={styles.eyebrow}>You’re reading together</Text>
        <Text style={styles.title}>{stage.pathName}</Text>
        <Text style={styles.body}>{Constants.ALREADY_PATH_MEMBER}</Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => openJoinedPath(stage.pathName).catch(() => undefined)}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{Constants.OPEN_PATH}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage.name === 'ready' || stage.name === 'joining') {
    const busy = stage.name === 'joining';
    const memberText = Constants.INVITE_MEMBER_COUNT.replace('{count}', String(stage.memberCount));
    return (
      <View style={styles.centered}>
        <Text style={styles.eyebrow}>{Constants.INVITE_ACCEPT_EYEBROW}</Text>
        <Text style={styles.title}>{stage.pathName}</Text>
        <Text style={styles.body}>{memberText}</Text>
        <TouchableOpacity
          style={[styles.primary, busy && styles.disabled]}
          onPress={join}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
        >
          <Text style={styles.primaryText}>{busy ? 'Joining…' : Constants.JOIN_NOW}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={goHome} accessibilityRole="button">
          <Text style={styles.secondaryText}>Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>This link can’t be opened</Text>
      <Text style={styles.body}>{stage.message}</Text>
      <TouchableOpacity style={styles.secondary} onPress={goHome} accessibilityRole="button">
        <Text style={styles.secondaryText}>Go to my paths</Text>
      </TouchableOpacity>
    </View>
  );
};
