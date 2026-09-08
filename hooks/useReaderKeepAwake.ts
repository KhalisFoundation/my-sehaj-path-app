import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { activateKeepAwake, deactivateKeepAwake } from '@sayem314/react-native-keep-awake';

/** Hold the display awake while the caller opts in and its reader is visible. */
export const useReaderKeepAwake = (enabled: boolean): void => {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused || !enabled) {
      return;
    }

    let holdingAwake = false;
    const update = (state: AppStateStatus) => {
      const shouldHold = state === 'active';
      if (shouldHold === holdingAwake) {
        return;
      }
      holdingAwake = shouldHold;
      if (shouldHold) {
        activateKeepAwake();
      } else {
        deactivateKeepAwake();
      }
    };

    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => {
      subscription.remove();
      if (holdingAwake) {
        deactivateKeepAwake();
      }
    };
  }, [enabled, isFocused]);
};
