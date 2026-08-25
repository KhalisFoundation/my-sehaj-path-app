import React, { useCallback, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, TouchableOpacity, View } from 'react-native';
import { AppText as Text } from './AppText';
import { MoreOptionsIcon } from '@icons';
import { Constants } from '@constants';
import { trackEvent } from '@utils/analytics';
import { deletePathCommand } from '../store/commands';
import { DialogStyles, PathOptionsMenuStyles as styles } from '@styles';

interface Props {
  pathId: number;
  pathName: string;
  /** Called once the path is gone, so the screen showing it can leave. */
  onDeleted: () => void;
  /**
   * Called with `true` the moment a delete starts, and `false` if it fails.
   *
   * The host screen is rendering this path. Deleting it makes the path vanish
   * from under that screen, which is indistinguishable from a failed load
   * unless the screen is told the disappearance was asked for.
   */
  onDeletingChange?: (isDeleting: boolean) => void;
}

type MenuView = 'closed' | 'menu' | 'confirm';

/** Breathing room between the dots and the menu, and against the screen edge. */
const MENU_GAP = 8;

/**
 * The path's "more actions" control: the three dots, its menu, and the
 * confirmation the destructive action needs.
 *
 * Menu and confirmation share ONE modal and swap the content inside it. Two
 * modals would read more naturally in code, but iOS refuses to present a modal
 * while another is still dismissing, so the confirmation would silently fail to
 * appear after the menu closed — the tap would look ignored. One modal has
 * nothing to dismiss, so the transition cannot lose the race.
 */
export const PathOptionsMenu = ({ pathId, pathName, onDeleted, onDeletingChange }: Props) => {
  const [view, setView] = useState<MenuView>('closed');
  const [isDeleting, setIsDeleting] = useState(false);
  const triggerRef = useRef<React.ComponentRef<typeof TouchableOpacity>>(null);
  const [anchor, setAnchor] = useState({ top: 0, right: 16 });

  /**
   * Measures the dots so the menu opens directly beneath them.
   *
   * A fixed inset would drift the moment this control is used on a screen with
   * a different header. Measuring keeps the menu attached to whatever opened it.
   */
  const openMenu = useCallback(() => {
    trackEvent('PathOptions', 'click', 'more options opened');
    triggerRef.current?.measureInWindow?.((x, y, width, height) => {
      setAnchor({
        top: y + height + MENU_GAP,
        right: Math.max(Dimensions.get('window').width - (x + width), MENU_GAP),
      });
    });
    setView('menu');
  }, []);

  const close = useCallback(() => {
    if (!isDeleting) {
      setView('closed');
    }
  }, [isDeleting]);

  const confirmDelete = useCallback(async () => {
    // Guard the double tap: the command is durable and a second call would ask
    // the outbox to delete a path this one already removed.
    if (isDeleting) {
      return;
    }
    setIsDeleting(true);
    // Before the command, not after: the path disappears from the host screen
    // partway through it, and the screen has to already know why.
    onDeletingChange?.(true);
    const deleted = await deletePathCommand(pathId);
    setIsDeleting(false);
    setView('closed');
    // The command alerts on failure; the screen only leaves when it worked.
    if (deleted) {
      onDeleted();
      return;
    }
    // Rolled back, so the path is on screen again and a later genuine load
    // failure must still be reported.
    onDeletingChange?.(false);
  }, [isDeleting, pathId, onDeleted, onDeletingChange]);

  return (
    <>
      <TouchableOpacity
        ref={triggerRef}
        onPress={openMenu}
        style={styles.trigger}
        accessibilityLabel={`More options for ${pathName}`}
        accessibilityRole="button"
        accessibilityHint="Tap to see actions for this Sehaj Path"
        hitSlop={12}
      >
        <MoreOptionsIcon />
      </TouchableOpacity>

      <Modal visible={view !== 'closed'} transparent animationType="fade" onRequestClose={close}>
        {view === 'menu' ? (
          // Deliberately undimmed: the menu is a light touch on a screen the
          // user is still looking at. Only the destructive confirmation below
          // dims, because that one wants their full attention. The backdrop is
          // invisible but still full-screen, so a tap anywhere closes the menu.
          <Pressable
            style={styles.menuBackdrop}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            {/* Swallows taps so pressing the menu itself does not dismiss it. */}
            <Pressable style={[styles.menu, anchor]} onPress={() => {}}>
              <TouchableOpacity
                onPress={() => {
                  // The intent, recorded before the confirmation. Paired with
                  // `PathDeleted` it shows how many people back out here.
                  trackEvent('PathOptions', 'click', 'delete pressed');
                  setView('confirm');
                }}
                style={styles.menuItem}
                accessibilityLabel={Constants.DELETE_PATH}
                accessibilityRole="button"
                accessibilityHint="Tap to delete this Sehaj Path"
              >
                <Text style={styles.destructiveItemText}>{Constants.DELETE_PATH}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        ) : (
          <View style={DialogStyles.backdrop}>
            <View style={DialogStyles.card}>
              <Text style={DialogStyles.title}>{Constants.DELETE_PATH_TITLE}</Text>
              <Text style={DialogStyles.message}>
                {Constants.DELETE_PATH_MESSAGE_BEFORE}
                <Text style={DialogStyles.strong}>{pathName}</Text>
                {Constants.DELETE_PATH_MESSAGE_AFTER}
              </Text>
              <View style={DialogStyles.actions}>
                <TouchableOpacity
                  onPress={close}
                  disabled={isDeleting}
                  style={DialogStyles.secondaryButton}
                  accessibilityLabel={Constants.CANCEL}
                  accessibilityRole="button"
                >
                  <Text style={DialogStyles.secondaryText}>{Constants.CANCEL}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmDelete}
                  disabled={isDeleting}
                  style={DialogStyles.destructiveButton}
                  accessibilityLabel={Constants.DELETE}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isDeleting }}
                >
                  <Text style={DialogStyles.primaryText}>
                    {isDeleting ? Constants.DELETING : Constants.DELETE}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Modal>
    </>
  );
};
