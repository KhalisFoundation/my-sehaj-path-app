import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { UIConstants } from '@constants/UIConstants';

interface Props {
  style?: StyleProp<ViewStyle>;
}

/**
 * The one backdrop behind every sidebar, sheet, pop-up and dialog: a soft blur
 * of the screen underneath with a grey tint over it.
 *
 * Each of these used to draw its own — a white blur behind the sidebar, plain
 * grey behind the turn pop-ups, a dark blur behind rename — so the same kind of
 * surface looked different depending on where it was opened. This is the look
 * the settings sheets already had.
 *
 * Purely visual: it never takes touches, so a caller keeps its own Pressable
 * for tap-to-close and renders this underneath (or inside) it. It fills its
 * parent; wrap it in an Animated.View to fade it.
 */
export const ModalBackdrop = ({ style }: Props) => (
  <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
    <BlurView
      style={StyleSheet.absoluteFill}
      blurType="light"
      blurAmount={UIConstants.MODAL_BACKDROP_BLUR_AMOUNT}
      reducedTransparencyFallbackColor={UIConstants.MODAL_BACKDROP_BLUR_FALLBACK}
    />
    <View style={[StyleSheet.absoluteFill, styles.tint]} />
  </View>
);

const styles = StyleSheet.create({
  tint: { backgroundColor: UIConstants.MODAL_BACKDROP_COLOR },
});
