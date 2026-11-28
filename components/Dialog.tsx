import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { DialogStyles as styles } from '@styles';

// iOS native modals default to portrait unless every supported orientation is
// declared, even when the navigator underneath is already in landscape.
const supportedOrientations: NonNullable<ModalProps['supportedOrientations']> = [
  'portrait',
  'landscape',
  'landscape-left',
  'landscape-right',
];

interface DialogProps {
  visible: boolean;
  /** Render inside an already-present modal (for example the drawer). */
  nativeModal?: boolean;
  /** Android back / swipe-to-dismiss handler. */
  onRequestClose?: () => void;
  /** Whether tapping the dimmed area should invoke {@link onRequestClose}. */
  dismissOnBackdropPress?: boolean;
  /**
   * Fires when the modal is genuinely on screen. iOS silently refuses to
   * present a modal while another one (or an in-app browser) already owns the
   * screen, and `visible` alone cannot tell you that happened.
   */
  onShow?: () => void;
  /** Optional layout overrides for dialogs with a more compact presentation. */
  backdropStyle?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
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
const DialogComponent = ({
  visible,
  nativeModal = true,
  onRequestClose,
  dismissOnBackdropPress = false,
  onShow,
  backdropStyle,
  cardStyle,
  children,
}: DialogProps) => {
  if (!visible) {
    return null;
  }

  const content = (
    <View
      style={[styles.backdrop, !nativeModal && styles.inlineBackdrop, backdropStyle]}
      accessibilityViewIsModal
      importantForAccessibility="yes"
    >
      {dismissOnBackdropPress && onRequestClose ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View style={[styles.card, cardStyle]}>{children}</View>
    </View>
  );

  if (!nativeModal) {
    return content;
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      onShow={onShow}
      supportedOrientations={supportedOrientations}
    >
      {content}
    </Modal>
  );
};

export const Dialog = React.memo(DialogComponent);
