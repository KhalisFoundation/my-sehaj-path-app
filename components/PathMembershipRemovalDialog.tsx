import React, { useCallback } from 'react';
import { Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { CrossIcon, InformationIcon } from '@icons';
import { scaledIconSize, useAppIconScale } from '../icons/useAppIconScale';
import { Dialog } from './Dialog';
import { PathMembershipRemovalDialogStyles as styles } from '@styles';

interface PathMembershipRemovalDialogProps {
  visible: boolean;
  pathName?: string;
  adminName?: string;
  onDismiss: () => void;
}

/**
 * A membership removal cannot be undone locally. Make that fact clear after a
 * notification tap, once Home has removed the inaccessible card.
 */
const PathMembershipRemovalDialogComponent = ({
  visible,
  pathName,
  adminName,
  onDismiss,
}: PathMembershipRemovalDialogProps) => {
  const iconScale = useAppIconScale();
  const closeIconSize = scaledIconSize(20, iconScale);
  const resolvedPathName = pathName?.trim() || 'this Sehaj Path';
  const actor = adminName?.trim() || 'an admin';
  const title = `You were removed from ${resolvedPathName} by ${actor}.`;
  const dismiss = useCallback(() => onDismiss(), [onDismiss]);

  return (
    <Dialog
      visible={visible}
      onRequestClose={dismiss}
      dismissOnBackdropPress
      cardStyle={styles.card}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Path update</Text>
          <Pressable
            style={[styles.closeButton, { width: closeIconSize }]}
            onPress={dismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close path update"
          >
            <CrossIcon baseSize={20} />
          </Pressable>
        </View>
        <View style={styles.infoBadge} accessible accessibilityLabel="Information">
          <InformationIcon width={38} height={38} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>You no longer have access to this path.</Text>
        <TouchableOpacity
          style={styles.action}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Got it"
        >
          <Text style={styles.actionText}>Got it</Text>
        </TouchableOpacity>
      </ScrollView>
    </Dialog>
  );
};

export const PathMembershipRemovalDialog = React.memo(PathMembershipRemovalDialogComponent);
