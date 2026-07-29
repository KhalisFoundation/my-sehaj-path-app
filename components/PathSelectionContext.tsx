import React, { createContext, useContext, useMemo } from 'react';

/**
 * Ephemeral verse selection / save state for the Path screen.
 *
 * This cluster of screen-local values plus their setters used to be drilled from
 * PathScreen through PathReader into every rendered verse (ten props at each
 * level). It is screen-scoped, non-persisted UI state, so it belongs in a
 * context rather than the Redux store.
 *
 * PathScreen still owns the underlying state and passes it to the provider;
 * descendants read it here instead of receiving it as props.
 */
export interface PathSelection {
  isSaving: boolean;
  isSaved: boolean;
  pressIndex: number;
  savedPathVerseId: number;
  hasPendingVerseSelection: boolean;
  found: boolean;
  setIsSaving: (value: boolean) => void;
  setIsSaved: (value: boolean) => void;
  setPressIndex: (value: number) => void;
  setSavedPathVerseId: (value: number) => void;
  setHasPendingVerseSelection: (value: boolean) => void;
  setFound: (value: boolean) => void;
}

const PathSelectionContext = createContext<PathSelection | null>(null);

export const usePathSelection = (): PathSelection => {
  const value = useContext(PathSelectionContext);
  if (!value) {
    throw new Error('usePathSelection must be used inside <PathSelectionProvider>');
  }
  return value;
};

interface ProviderProps extends PathSelection {
  children: React.ReactNode;
}

export const PathSelectionProvider = ({
  children,
  isSaving,
  isSaved,
  pressIndex,
  savedPathVerseId,
  hasPendingVerseSelection,
  found,
  setIsSaving,
  setIsSaved,
  setPressIndex,
  setSavedPathVerseId,
  setHasPendingVerseSelection,
  setFound,
}: ProviderProps) => {
  const value = useMemo(
    () => ({
      isSaving,
      isSaved,
      pressIndex,
      savedPathVerseId,
      hasPendingVerseSelection,
      found,
      setIsSaving,
      setIsSaved,
      setPressIndex,
      setSavedPathVerseId,
      setHasPendingVerseSelection,
      setFound,
    }),
    [
      isSaving,
      isSaved,
      pressIndex,
      savedPathVerseId,
      hasPendingVerseSelection,
      found,
      setIsSaving,
      setIsSaved,
      setPressIndex,
      setSavedPathVerseId,
      setHasPendingVerseSelection,
      setFound,
    ]
  );

  return <PathSelectionContext.Provider value={value}>{children}</PathSelectionContext.Provider>;
};
