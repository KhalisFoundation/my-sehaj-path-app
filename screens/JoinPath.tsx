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
import { ensureAccessiblePath } from '../store/applyServerResponse';
import { store } from '../store';
import { runConfirmedAccountSync } from '../store/confirmedSync';
import { hasLocalData } from '../store/syncWork';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinPath'>;

type Stage =
  | { name: 'loading' }
  | { name: 'ready'; pathId: string; pathName: string; memberCount: number }
  | { name: 'joining'; pathId: string; pathName: string; memberCount: number }
  | { name: 'member'; pathId: string; pathName: string }
  | { name: 'signed-out'; pathId?: string; pathName?: string; memberCount?: number }
  | { name: 'sync-error'; message: string }
  | { name: 'dead'; message: string };

/** Shows the invite details before a reader confirms their direct join. */
export const JoinPath = ({ route, navigation }: Props) => {
  const { token } = route.params;
  useScreenAnalytics('JoinPath', 'JoinPath');
  const [stage, setStage] = useState<Stage>({ name: 'loading' });
  const authStatus = useAppSelector((state) => state.auth.status);
  const signingIn = useAppSelector((state) => state.auth.signingIn);
  const authEmail = useAppSelector((state) => state.auth.email);

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
    async (sehajPathId: string): Promise<boolean> => {
      try {
        const localPathId = await ensureAccessiblePath(store, sehajPathId);
        if (localPathId === null) {
          showErrorAlert(ErrorConstants.FAILED_TO_OPEN_SHARED_PATH);
          return false;
        }
        navigation.replace(Routes.Continue, { pathId: localPathId, initialTab: 'progress' });
        return true;
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_OPEN_SHARED_PATH);
        return false;
      }
    },
    [navigation]
  );

  const load = useCallback(async () => {
    if (authStatus === 'unknown' || signingIn) {
      return;
    }
    setStage({ name: 'loading' });

    // Invite joining must not race the account association performed after SSO.
    // If this device has unowned reading, automatically back it up to the
    // signed-in account before resolving/joining the shared path. This is
    // deliberately silent: the invite flow has already established the
    // account context, and local progress is never merged into the group.
    if (
      authStatus === 'signedIn' &&
      authEmail &&
      store.getState().sync.account === null &&
      hasLocalData(store)
    ) {
      const synced = await runConfirmedAccountSync(store, authEmail);
      if (!synced) {
        setStage({
          name: 'sync-error',
          message: ErrorConstants.FAILED_TO_SYNC,
        });
        return;
      }
    }

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
        pathId: preview.data.sehajPathId,
        pathName: preview.data.name,
        memberCount: preview.data.memberCount,
      });
      return;
    }

    if (preview.data.membership === 'ACTIVE') {
      setStage({ name: 'member', pathId: preview.data.sehajPathId, pathName: preview.data.name });
      return;
    }

    setStage({
      name: 'ready',
      pathId: preview.data.sehajPathId,
      pathName: preview.data.name,
      memberCount: preview.data.memberCount,
    });
  }, [authEmail, authStatus, signingIn, token]);

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
        pathId: stage.pathId,
        pathName: stage.pathName,
        memberCount: stage.memberCount,
      });
      return;
    }

    setStage({
      name: 'joining',
      pathId: stage.pathId,
      pathName: stage.pathName,
      memberCount: stage.memberCount,
    });
    trackSharedPathEvent('JOIN');
    const result = await joinInvite(token);
    if (result.ok) {
      setStage({ name: 'member', pathId: stage.pathId, pathName: stage.pathName });
      await openJoinedPath(stage.pathId);
      return;
    }
    if (result.kind === 'signed-out') {
      setStage({
        name: 'signed-out',
        pathId: stage.pathId,
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
          onPress={() => openJoinedPath(stage.pathId).catch(() => undefined)}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{Constants.OPEN_PATH}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (stage.name === 'sync-error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Unable to sync your progress</Text>
        <Text style={styles.body}>{stage.message}</Text>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => load().catch(() => undefined)}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Retry</Text>
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
