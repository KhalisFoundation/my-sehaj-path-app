import React from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppText as Text } from './AppText';
import { MembersRowStyles as styles } from '@styles';
import { Constants } from '@constants';
import { initialOf, tintFor } from './MemberAvatars';
import type { SehajPathMember } from '@api/generated/types.gen';

interface Props {
  members: SehajPathMember[];
  /** Built by the caller, which holds the auth headers the URL needs. */
  avatarUriFor?: (member: SehajPathMember) => string | null;
  onAdd: () => void;
  onShare?: () => void;
  inviteStatus?: 'unknown' | 'none' | 'active' | 'expired';
  inviteExpiryHours?: number | null;
  onInviteExpiryChange?: (hours: number | null) => void;
  onCreateInvite?: (autoCreate?: boolean) => void;
  onLeave?: () => void;
  showActions?: boolean;
  canManageMembers?: boolean;
  onMakeAdmin?: (member: SehajPathMember) => void;
  onToggleAdmin?: (member: SehajPathMember) => void;
  onRemoveMember?: (member: SehajPathMember) => void;
  membersError?: string | null;
  onRetryMembers?: () => void;
}

/**
 * Who is reading this path, at the foot of the progress view.
 *
 * Named faces rather than the overlapping stack used on the path cards: there
 * is room here, and the point is different. On a card the stack says "this is
 * shared"; here the reader is looking for a particular person, so each face
 * carries its own name.
 */
export const MembersRow = ({
  members,
  avatarUriFor,
  onAdd,
  onShare,
  inviteStatus = 'unknown',
  inviteExpiryHours = 168,
  onInviteExpiryChange,
  onCreateInvite,
  onLeave,
  showActions = true,
  canManageMembers: canManageMembersProp,
  onMakeAdmin,
  onToggleAdmin,
  onRemoveMember,
  membersError = null,
  onRetryMembers,
}: Props) => {
  const [selectedMember, setSelectedMember] = React.useState<SehajPathMember | null>(null);
  const [popoverPosition, setPopoverPosition] = React.useState({ top: 0, left: 0 });
  const memberButtonRefs = React.useRef<
    Record<string, React.ComponentRef<typeof TouchableOpacity> | null>
  >({});
  const canManageMembers =
    canManageMembersProp ?? members.some((member) => member.isMine && member.role === 'ADMIN');

  return (
    <View style={styles.membersRoot}>
      <View style={styles.memberHeader}>
        <Text style={styles.memberHeaderTitle}>{Constants.TOTAL_MEMBERS}</Text>
        <Text style={styles.memberHeaderCount}>{members.length}</Text>
      </View>
      <ScrollView
        style={[styles.memberList, members.length === 0 && styles.emptyMemberList]}
        contentContainerStyle={[
          styles.memberListContent,
          members.length > 0 && styles.memberListContentFilled,
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator={members.length > 0}
      >
        {membersError !== null ? (
          <>
            <Text style={styles.emptyMessage}>{membersError}</Text>
            {onRetryMembers && (
              <TouchableOpacity
                onPress={onRetryMembers}
                style={styles.secondaryAction}
                accessibilityRole="button"
                accessibilityLabel={Constants.RETRY}
              >
                <Text style={styles.secondaryActionText}>{Constants.RETRY}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : members.length === 0 ? (
          <Text style={styles.emptyMessage}>{Constants.PATH_NOT_SHARED_YET}</Text>
        ) : (
          members.map((member) => {
            const uri = avatarUriFor?.(member) ?? null;
            return (
              <View key={member.id} style={styles.member}>
                {uri ? (
                  <Image source={{ uri }} style={styles.avatar} />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      styles.fallback,
                      { backgroundColor: tintFor(member.id) },
                    ]}
                  >
                    <Text style={styles.initial}>{initialOf(member.displayLabel)}</Text>
                  </View>
                )}
                <View style={styles.memberCopy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {member.displayLabel}
                    {member.isMine ? ' (You)' : ''}
                  </Text>
                  {member.role === 'ADMIN' && <Text style={styles.role}>Admin</Text>}
                </View>
                {canManageMembers && !member.isMine && (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedMember(member);
                      const button = memberButtonRefs.current[member.id];
                      button?.measureInWindow?.((x, y, width, height) => {
                        const popoverWidth = 208;
                        const popoverHeight = 150;
                        const screen = Dimensions.get('window');
                        const left = Math.min(
                          Math.max(12, x + width - popoverWidth),
                          screen.width - popoverWidth - 12
                        );
                        const below = y + height + 8;
                        const top = Math.min(below, screen.height - popoverHeight - 12);
                        setPopoverPosition({ top, left });
                      });
                    }}
                    ref={(button) => {
                      memberButtonRefs.current[member.id] = button;
                    }}
                    style={styles.menu}
                    accessibilityRole="button"
                    accessibilityLabel={`Actions for ${member.displayLabel}`}
                  >
                    <Text style={styles.menuText}>⋮</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={styles.memberActions}>
        {canManageMembers && showActions && (
          <>
            {Constants.ENABLE_IN_APP_MEMBER_ADD && (
              <TouchableOpacity
                onPress={onAdd}
                style={styles.primaryAction}
                accessibilityRole="button"
              >
                <Text style={styles.primaryActionText}>Add members</Text>
              </TouchableOpacity>
            )}
            {inviteStatus === 'none' || inviteStatus === 'expired' ? (
              <View style={styles.inviteCreateSection}>
                {inviteStatus === 'expired' && (
                  <Text style={styles.inviteExpired}>{Constants.INVITE_LINK_EXPIRED}</Text>
                )}
                {inviteStatus === 'none' && (
                  <>
                    <Text style={styles.inviteHint}>{Constants.CREATE_LINK_HINT}</Text>
                    <View style={styles.inviteExpiryOptions}>
                      {[
                        { label: Constants.EXPIRY_24_HOURS, hours: 24 },
                        { label: Constants.EXPIRY_7_DAYS, hours: 168 },
                        { label: Constants.EXPIRY_30_DAYS, hours: 720 },
                        { label: Constants.NO_EXPIRY, hours: null },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.label}
                          onPress={() => onInviteExpiryChange?.(option.hours)}
                          style={[
                            styles.inviteExpiryOption,
                            inviteExpiryHours === option.hours && styles.inviteExpirySelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.inviteExpiryText,
                              inviteExpiryHours === option.hours && styles.inviteExpirySelectedText,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <TouchableOpacity
                  onPress={() => {
                    if (onCreateInvite) {
                      onCreateInvite(inviteStatus === 'none');
                    } else {
                      (onShare ?? onAdd)();
                    }
                  }}
                  style={styles.secondaryAction}
                  accessibilityRole="button"
                >
                  <Text style={styles.secondaryActionText}>{Constants.CREATE_LINK}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={onShare ?? onAdd}
                style={styles.secondaryAction}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryActionText}>{Constants.SHARE_INVITE_LINK}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {!canManageMembers && onLeave && (
          <TouchableOpacity
            onPress={onLeave}
            style={styles.leaveAction}
            accessibilityRole="button"
            accessibilityLabel="Leave path"
          >
            <Text style={styles.leaveActionText}>Leave path</Text>
          </TouchableOpacity>
        )}
      </View>
      <Modal
        visible={selectedMember !== null}
        transparent
        animationType="none"
        onRequestClose={() => setSelectedMember(null)}
      >
        <Pressable style={styles.actionBackdrop} onPress={() => setSelectedMember(null)} />
        <View style={[styles.actionPopover, popoverPosition]}>
          <Text style={styles.popoverTitle} numberOfLines={1}>
            {selectedMember?.displayLabel}
          </Text>
          <TouchableOpacity
            style={styles.popoverAction}
            onPress={() => {
              if (selectedMember) {
                if (onToggleAdmin) {
                  onToggleAdmin(selectedMember);
                } else {
                  onMakeAdmin?.(selectedMember);
                }
              }
              setSelectedMember(null);
            }}
          >
            <Text style={styles.adminText}>
              {selectedMember?.role === 'ADMIN' ? 'Remove admin' : 'Make admin'}
            </Text>
          </TouchableOpacity>
          <View style={styles.popoverDivider} />
          <TouchableOpacity
            style={styles.popoverAction}
            onPress={() => {
              if (selectedMember) {
                onRemoveMember?.(selectedMember);
              }
              setSelectedMember(null);
            }}
          >
            <Text style={styles.removeText}>Remove member</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};
