import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, useWindowDimensions } from 'react-native';

const BACKDROP_FADE_DURATION = 180;
const CLOSE_DURATION = 240;

/**
 * Controls a modal bottom sheet's visibility, entrance/exit animation, and
 * downward drag-to-dismiss gesture. Keeping this here lets sheet consumers
 * focus only on their trigger and content.
 */
export const useSelectionBottomSheet = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const isMounted = useRef(true);
  const screenHeightRef = useRef(screenHeight);
  const dismissRef = useRef<() => void>(() => undefined);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  screenHeightRef.current = screenHeight;

  const stopCurrentAnimation = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const animateToRest = useCallback(() => {
    stopCurrentAnimation();
    const animation = Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]);
    animationRef.current = animation;
    animation.start();
  }, [backdropOpacity, stopCurrentAnimation, translateY]);

  const close = useCallback(() => {
    if (!isVisible || isClosing.current) {
      return;
    }

    isClosing.current = true;
    stopCurrentAnimation();
    const animation = Animated.parallel([
      Animated.timing(translateY, {
        toValue: screenHeightRef.current,
        duration: CLOSE_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: BACKDROP_FADE_DURATION,
        useNativeDriver: true,
      }),
    ]);
    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished && isMounted.current) {
        setIsVisible(false);
      }
      isClosing.current = false;
    });
  }, [backdropOpacity, isVisible, stopCurrentAnimation, translateY]);

  dismissRef.current = close;

  const panResponder = useRef(
    PanResponder.create({
      // Claim the dedicated drag affordance at touch start so a parent scroll
      // view cannot swallow a downward dismiss gesture.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        stopCurrentAnimation();
      },
      onPanResponderMove: (_, gesture) => {
        const distance = Math.max(0, gesture.dy);
        translateY.setValue(distance);
        backdropOpacity.setValue(
          Math.max(0, 1 - distance / Math.max(1, screenHeightRef.current * 0.55))
        );
      },
      onPanResponderRelease: (_, gesture) => {
        const shouldDismiss = gesture.dy > screenHeightRef.current * 0.18 || gesture.vy > 0.8;
        if (shouldDismiss) {
          dismissRef.current();
          return;
        }
        animateToRest();
      },
      onPanResponderTerminate: animateToRest,
    })
  ).current;

  const open = useCallback(() => {
    isClosing.current = false;
    stopCurrentAnimation();
    translateY.setValue(screenHeightRef.current);
    backdropOpacity.setValue(0);
    setIsVisible(true);
  }, [backdropOpacity, stopCurrentAnimation, translateY]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    animateToRest();
  }, [animateToRest, isVisible]);

  useEffect(
    () => () => {
      isMounted.current = false;
      stopCurrentAnimation();
    },
    [stopCurrentAnimation]
  );

  return {
    isVisible,
    open,
    close,
    translateY,
    backdropOpacity,
    panHandlers: panResponder.panHandlers,
  };
};
