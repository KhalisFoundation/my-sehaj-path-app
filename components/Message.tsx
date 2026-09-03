import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { AppText as Text } from './AppText';
import { NavContent } from '@components';
import { SaveIcon } from '@icons';
import { MessageStyles } from '@styles';

/** Self-driven timings: long enough to read, short enough to stay out of the way. */
const FADE_IN_MS = 180;
const HOLD_MS = 2000;
const FADE_OUT_MS = 220;

interface Props {
  message: string;
  fadeAnim?: Animated.Value;
  icon?: React.ReactNode;
  onHidden?: () => void;
  /**
   * Overrides placement. The default sits flush to the bottom, which suits the
   * reader — it tucks under the controls there — but reads as pinned to the
   * screen edge anywhere content ends higher up.
   */
  style?: StyleProp<ViewStyle>;
}

export const Message = ({ message, fadeAnim, icon, onHidden, style }: Props) => {
  const ownAnim = useRef(new Animated.Value(0)).current;
  const opacity = fadeAnim ?? ownAnim;

  // Held in a ref so an inline callback from the host does not restart the
  // animation on every render.
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;

  useEffect(() => {
    if (fadeAnim) {
      return; // the caller owns the timing
    }
    ownAnim.setValue(0);
    const animation = Animated.sequence([
      Animated.timing(ownAnim, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }),
      Animated.delay(HOLD_MS),
      Animated.timing(ownAnim, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        onHiddenRef.current?.();
      }
    });
    return () => animation.stop();
  }, [fadeAnim, ownAnim, message]);

  return (
    <Animated.View pointerEvents="none" style={[MessageStyles.saveContainer, style, { opacity }]}>
      <NavContent navIcon={icon ?? <SaveIcon />} />
      <Text style={MessageStyles.saveText} allowFontScaling={false}>
        {message}
      </Text>
    </Animated.View>
  );
};
