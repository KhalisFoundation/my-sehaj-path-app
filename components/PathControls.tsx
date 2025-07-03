import React from 'react';
import { NavContent } from '@components';
import { SaveIcon, SettingsIcon, PauseIcon, PlayIcon, HomeIcon } from '@icons';

interface Props {
  handleGoBack: () => void;
  setIsSaving: (isSaving: boolean) => void;
  isSaving: boolean;
  fadeAnim: any;
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;
  navigation: any;
}
export const PathControls = ({
  handleGoBack,
  setIsSaving,
  isSaving,
  fadeAnim,
  autoScroll,
  setAutoScroll,
  navigation,
}: Props) => {
  return (
    <>
      <NavContent navIcon={<HomeIcon />} onPress={() => handleGoBack()} />
      <NavContent
        navIcon={<SaveIcon />}
        onPress={() => {
          setIsSaving(!isSaving);
          fadeAnim.setValue(1);
        }}
      />
      <NavContent
        navIcon={autoScroll ? <PauseIcon /> : <PlayIcon />}
        onPress={() => setAutoScroll(!autoScroll)}
      />
      <NavContent navIcon={<SettingsIcon />} onPress={() => navigation.push('Setting')} />
    </>
  );
};
