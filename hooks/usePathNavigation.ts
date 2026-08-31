import { useCallback } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showLeaveAnywayAlert, showSaveProgressAlert } from '@utils/alerts';
import { Routes } from '@constants';
import { store } from '../store';
import { RootStackParamList } from '../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UsePathNavigationProps {
  isAngNavigation: boolean;
  pathAng: number;
  pathId: number;
  setIsAngNavigation: (value: boolean) => void;
  updatePathAng: (angNumber: number) => void;
  navigation: NavigationProp;
  /** Persists the current position; resolves false if it could not be saved. */
  persistCurrentScroll: () => Promise<boolean>;
  /**
   * Stops the leave checkpoint writing on the way out.
   *
   * Leaving removes the screen, which fires the reader's `beforeRemove`
   * checkpoint — and that persists the ang currently on screen. When the user
   * has just declined to save, that is the ang they declined.
   */
  suppressLeaveSave: () => void;
}

export const usePathNavigation = ({
  isAngNavigation,
  pathAng,
  pathId,
  setIsAngNavigation,
  updatePathAng,
  navigation,
  persistCurrentScroll,
  suppressLeaveSave,
}: UsePathNavigationProps) => {
  const persistAndNavigate = useCallback(
    async (navigate: () => void) => {
      const saved = await persistCurrentScroll();
      if (!saved) {
        // Never trap the user: let them retry (stay) or leave anyway. Leaving is
        // their explicit choice, so we don't force them to stay on a broken disk.
        showLeaveAnywayAlert({ onLeaveAnyway: navigate });
        return;
      }
      navigate();
    },
    [persistCurrentScroll]
  );

  const confirmBeforeLeaving = useCallback(
    async (navigate: () => void, destinationLabel = 'Home') => {
      if (isAngNavigation) {
        const currentMatchedPath = store
          .getState()
          .paths.paths.find((path) => path.pathId === pathId);
        const lastSavedAngNumber = currentMatchedPath?.saveData.angNumber || 0;

        if (pathAng !== lastSavedAngNumber) {
          showSaveProgressAlert({
            onSaveAndGoBack: async () => {
              setIsAngNavigation(false);
              await persistAndNavigate(navigate);
            },
            onGoBackWithoutSaving: () => {
              // Before navigating: leaving triggers the reader's own checkpoint,
              // which would write the ang being abandoned.
              suppressLeaveSave();
              updatePathAng(lastSavedAngNumber);
              navigate();
            },
            destinationLabel,
          });
        } else {
          await persistAndNavigate(navigate);
        }
      } else {
        await persistAndNavigate(navigate);
      }
    },
    [
      isAngNavigation,
      pathAng,
      pathId,
      persistAndNavigate,
      setIsAngNavigation,
      updatePathAng,
      suppressLeaveSave,
    ]
  );

  const handleGoBack = useCallback(
    // Home already exists below Continue/Path. Pushing another Home retains the
    // whole paragraph reader in the stack; repeated reading sessions then pile
    // up native Text trees and progressively degrade scrolling/transitions.
    () => confirmBeforeLeaving(() => navigation.popTo(Routes.Home), 'Home'),
    [confirmBeforeLeaving, navigation]
  );

  return { handleGoBack, confirmBeforeLeaving };
};
