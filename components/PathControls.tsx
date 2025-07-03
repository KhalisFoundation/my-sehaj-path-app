import React from 'react';
import { NavContent } from './NavContent';
import { SaveIcon } from '@icons/Save.icon';
import { SettingsIcon } from '@icons/Settings.icon';
import { PauseIcon } from '@icons/Pause.icon';
import { PlayIcon } from '@icons/Play.icon';
import { HomeIcon } from '@icons/Home.icon';

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
