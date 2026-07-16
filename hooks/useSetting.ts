import { useCallback } from 'react';
import type { ActionCreatorWithPayload } from '@reduxjs/toolkit';
import { showErrorAlert } from '@utils';
import type { RootState } from '../store';
import { commitSettingChange } from '../store/commands';
import { useAppSelector } from '../store/hooks';

/**
 * Reads a setting from the store and returns a setter that only reports success
 * once the change is durable.
 *
 * Replaces the old per-component `useState` + `useEffect(fetchFn)` +
 * `saveFn`/`errorMessages` prop drilling: the value is now reactive everywhere.
 *
 * Saving goes through the serialized `commitSettingChange`, which owns the
 * dispatch, the durable flush, and the rollback (including a durable rollback
 * flush). Doing it here in the hook would neither serialize against path
 * commands nor guarantee the rollback reached disk.
 */
export const useSetting = <T>(
  select: (state: RootState) => T,
  actionCreator: ActionCreatorWithPayload<T>,
  saveError: string
): [T, (next: T) => Promise<void>] => {
  const value = useAppSelector(select);

  const set = useCallback(
    async (next: T) => {
      const saved = await commitSettingChange(actionCreator(next));
      if (!saved) {
        showErrorAlert(saveError);
      }
    },
    [actionCreator, saveError]
  );

  return [value, set];
};
