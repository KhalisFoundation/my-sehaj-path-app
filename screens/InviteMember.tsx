import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText as Text } from '../components/AppText';
import { InviteMemberStyles as styles } from '@styles';
import { createInvite, enableSharing, listMembers } from '../store/groupApi';
import { inviteLinkFor } from '../navigation/linking';
import { storeInviteLink } from '../store/inviteLink';
import type { SehajPathMember } from '@api/generated/types.gen';
import type { RootStackParamList } from '../App';
import { trackSharedPathEvent } from '../utils/sharedPathAnalytics';
import { useScreenAnalytics } from '@hooks';

type Props = NativeStackScreenProps<RootStackParamList, 'InviteMember'>;

/**
 * Inviting somebody into a path, and seeing who is already in it.
 *
 * Two things happen here that look like one: a personal path becomes shared,
 * and a link is minted. They are separate on the server and separate here,
 * because the first is irreversible in practice — once other people are reading
 * it, a path cannot quietly go back to being one person's.
 *
 * The link is minted on a tap rather than on mount for the same reason. Opening
 * a screen should not change what a path IS.
 */
export const InviteMember = ({ route }: Props) => {
  const { sehajPathId, pathName } = route.params;
  useScreenAnalytics('InviteMember', 'InviteMember');

  const [members, setMembers] = useState<SehajPathMember[] | null>(null);
  /**
   * Held in state because the server never returns it again — it stores only a
   * hash. Leaving this screen loses the link, and the only recovery is minting
   * a new one, which is why the copy below says so.
   */
  const [link, setLink] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listMembers(sehajPathId);
    // A path that is not shared yet has no member list, and that is not an
    // error — it is the normal state before the first invite.
    setMembers(result.ok ? result.data : []);
  }, [sehajPathId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const mint = useCallback(async () => {
    if (minting) {
      return;
    }
    setMinting(true);
    setProblem(null);
    trackSharedPathEvent('INVITE_CREATE');

    // Idempotent server-side, so this is safe on a path that is already shared
    // — which is every time after the first invite.
    const shared = await enableSharing(sehajPathId);
    if (!shared.ok) {
      setMinting(false);
      setProblem(shared.message);
      return;
    }

    const invite = await createInvite(sehajPathId);
    setMinting(false);

    if (!invite.ok) {
      setProblem(invite.message);
      return;
    }

    const nextLink = inviteLinkFor(invite.data.token);
    await storeInviteLink(sehajPathId, nextLink, invite.data.expiresAt);
    setLink(nextLink);
    // Sharing may have just created the owner's own membership row.
    load().catch(() => undefined);
  }, [sehajPathId, minting, load]);

  const share = useCallback(async () => {
    if (!link) {
      return;
    }
    trackSharedPathEvent('INVITE_SHARE');
    try {
      // The platform's own sheet rather than a Copy button: the next step is
      // always "send this to someone", and this is the one gesture that does it.
      await Share.share({ message: link });
    } catch {
      // Dismissing the sheet throws on some platforms. Nothing went wrong.
    }
  }, [link]);

  const active = (members ?? []).filter((member) => member.status === 'ACTIVE');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Invite a member</Text>
        {pathName ? <Text style={styles.subtitle}>{pathName}</Text> : null}

        {problem !== null && <Text style={styles.problem}>{problem}</Text>}

        {link === null ? (
          <>
            <Text style={styles.body}>Anyone with the link can join this path directly.</Text>
            <TouchableOpacity
              style={[styles.primary, minting && styles.disabled]}
              onPress={mint}
              disabled={minting}
              accessibilityRole="button"
              accessibilityState={{ disabled: minting }}
            >
              <Text style={styles.primaryText}>
                {minting ? 'Creating…' : 'Create an invite link'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.linkBox}>
              <Text style={styles.link} numberOfLines={2}>
                {link}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.primary}
              onPress={share}
              accessibilityRole="button"
              accessibilityLabel="Share this invite link"
            >
              <Text style={styles.primaryText}>Share link</Text>
            </TouchableOpacity>
            {/* Said plainly because it is genuinely unrecoverable, not a
                warning about carelessness. */}
            <Text style={styles.hint}>
              Send it now — this link can’t be shown again. You can always create another.
            </Text>
          </>
        )}

        <Text style={styles.sectionLabel}>Reading together</Text>

        {members === null ? (
          <ActivityIndicator style={styles.loading} />
        ) : active.length === 0 ? (
          <Text style={styles.empty}>Nobody else has joined yet.</Text>
        ) : (
          active.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <Text style={styles.memberName} numberOfLines={1}>
                {member.displayLabel}
              </Text>
              {member.role === 'ADMIN' && <Text style={styles.badge}>Admin</Text>}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};
