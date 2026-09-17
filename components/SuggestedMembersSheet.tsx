import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { AppText as Text } from './AppText';
import { AddMembersStyles as styles, InviteSheetStyles } from '@styles';
import { addMember, listSuggestedMembers, type SuggestedMember } from '../store/groupApi';
import { initialOf, tintFor } from './MemberAvatars';
import { Constants, ErrorConstants, UIConstants } from '@constants';
import { getStoredInviteLink } from '../store/inviteLink';
import { trackSharedPathEvent } from '../utils/sharedPathAnalytics';
import { showErrorAlert } from '../utils/Error';
import { recordError } from '../utils/crashlytics';

interface Props {
  visible: boolean;
  sehajPathId: string;
  existingMembers: { userId: string | null }[];
  onClose: () => void;
  onAdded?: () => void;
}

export const SuggestedMembersSheet = ({
  visible,
  sehajPathId,
  existingMembers,
  onClose,
  onAdded,
}: Props) => {
  const [suggestions, setSuggestions] = useState<SuggestedMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [addedUserIds, setAddedUserIds] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setLink(null);
    setCopied(false);
    setAddedUserIds(
      new Set(
        existingMembers
          .map((member) => member.userId)
          .filter((userId): userId is string => userId !== null)
      )
    );

    try {
      const result = await listSuggestedMembers();
      if (!result.ok) {
        setSuggestions([]);
        setLoadError(true);
        return;
      }

      setSuggestions(result.data);
      if (result.data.length === 0) {
        const existingLink = await getStoredInviteLink(sehajPathId);
        if (existingLink !== null) {
          setLink(existingLink);
        }
      }
    } catch (error) {
      recordError(error, 'SuggestedMembersSheet: failed to load suggestions');
      setSuggestions([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [existingMembers, sehajPathId]);

  useEffect(() => {
    if (visible) {
      loadSuggestions().catch(() => undefined);
    }
  }, [loadSuggestions, visible]);

  const add = useCallback(
    async (member: SuggestedMember) => {
      if (busyUserId || addedUserIds.has(member.userId)) {
        return;
      }
      setBusyUserId(member.userId);
      trackSharedPathEvent('MEMBER_ADD');
      try {
        const result = await addMember(sehajPathId, member.userId);
        if (result.ok) {
          setAddedUserIds((ids) => new Set(ids).add(member.userId));
          await onAdded?.();
        } else {
          showErrorAlert(result.message);
        }
      } catch (error) {
        recordError(error, 'SuggestedMembersSheet: failed to add member');
        showErrorAlert(ErrorConstants.FAILED_TO_ADD_MEMBER);
      } finally {
        setBusyUserId(null);
      }
    },
    [addedUserIds, busyUserId, onAdded, sehajPathId]
  );

  const showEmptyState =
    !loading && !loadError && (!Constants.ENABLE_IN_APP_MEMBER_ADD || suggestions.length === 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={InviteSheetStyles.backdrop} onPress={onClose} />
      <View style={[InviteSheetStyles.sheet, styles.suggestedSheet]}>
        <View style={InviteSheetStyles.grabber} />
        <Text style={InviteSheetStyles.title}>Add members</Text>
        {loading ? (
          <ActivityIndicator color={UIConstants.PRIMARY_COLOR} style={InviteSheetStyles.loading} />
        ) : null}
        {!loading && loadError ? (
          <View style={InviteSheetStyles.loadingState}>
            <Text style={styles.empty}>{ErrorConstants.FAILED_TO_LOAD_SUGGESTED_MEMBERS}</Text>
            <TouchableOpacity
              style={InviteSheetStyles.share}
              onPress={() => loadSuggestions().catch(() => undefined)}
              accessibilityRole="button"
              accessibilityLabel="Retry loading suggested members"
            >
              <Text style={InviteSheetStyles.shareText}>{Constants.RETRY}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {showEmptyState ? (
          <>
            <Text style={styles.empty}>{Constants.SHARE_LINK_TO_ADD_MEMBERS}</Text>
            {link ? (
              <View style={InviteSheetStyles.linkRow}>
                <Text style={InviteSheetStyles.link} numberOfLines={1}>
                  {link}
                </Text>
                <TouchableOpacity
                  style={InviteSheetStyles.copy}
                  onPress={() => {
                    trackSharedPathEvent('INVITE_COPY');
                    Clipboard.setString(link);
                    setCopied(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite link"
                >
                  <Text style={InviteSheetStyles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}
        {!loadError && Constants.ENABLE_IN_APP_MEMBER_ADD && (
          <ScrollView
            style={styles.suggestedMemberList}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((member, index) => {
              const added = addedUserIds.has(member.userId);
              return (
                <React.Fragment key={member.userId}>
                  {index > 0 ? <View style={styles.memberDivider} /> : null}
                  <View style={styles.memberRow}>
                    <View style={[styles.avatar, { backgroundColor: tintFor(member.userId) }]}>
                      <Text style={styles.avatarText}>{initialOf(member.displayLabel)}</Text>
                    </View>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.displayLabel}
                    </Text>
                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={() => add(member)}
                      disabled={added || busyUserId === member.userId}
                    >
                      <Text style={styles.inviteText}>
                        {added ? 'Added' : busyUserId === member.userId ? 'Adding…' : 'Add'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};
