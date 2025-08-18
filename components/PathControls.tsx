import React from 'react';
import { NavContent } from '@components';
import { SaveIcon, SettingsIcon, PauseIcon, PlayIcon, HomeIcon } from '@icons';
import { Animated } from 'react-native';

interface Props {
  handleGoBack: () => void;
  setIsSaving: (isSaving: boolean) => void;
  isSaving: boolean;
  fadeAnim: React.MutableRefObject<Animated.Value>;
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
          fadeAnim.current.setValue(1);
        }}
      />
      <NavContent
        navIcon={autoScroll ? <PauseIcon /> : <PlayIcon />}
        onPress={() => {
          console.log('Auto-scroll button pressed, current state:', autoScroll);
          setAutoScroll(!autoScroll);
        }}
      />
      <NavContent navIcon={<SettingsIcon />} onPress={() => navigation.push('Setting')} />
    </>
  );
};
