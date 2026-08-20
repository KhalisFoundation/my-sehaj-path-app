import React from 'react';
import { Modal, View } from 'react-native';
import { DialogStyles as styles } from '@styles';

interface DialogProps {
  visible: boolean;
  /** Android back / swipe-to-dismiss handler. */
  onRequestClose?: () => void;
  /**
   * Fires when the modal is genuinely on screen. iOS silently refuses to
   * present a modal while another one (or an in-app browser) already owns the
   * screen, and `visible` alone cannot tell you that happened.
   */
  onShow?: () => void;
  /** The dialog's content — title, message, buttons, or anything else. */
  children: React.ReactNode;
}

/**
 * Reusable dialog box. Owns only the chrome — the dimmed backdrop and the
 * centered card — and renders whatever content the caller passes as children.
 * This keeps the look consistent while leaving each popup full control over what
 * to show inside. Shared inner styles live in `DialogStyles` (title, message,
 * actions, buttons) for callers that want the default treatment.
 */
const DialogComponent = ({ visible, onRequestClose, onShow, children }: DialogProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onRequestClose}
    onShow={onShow}
  >
    <View style={styles.backdrop}>
      <View style={styles.card}>{children}</View>
    </View>
  </Modal>
);

export const Dialog = React.memo(DialogComponent);
