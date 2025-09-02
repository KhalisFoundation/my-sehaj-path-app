import React from 'react';
import { NavContent } from '@components';
import { SaveIcon, SettingsIcon, PauseIcon, PlayIcon, HomeIcon } from '@icons';
import { Animated } from 'react-native';

interface Props {
  handleGoBack: () => void;
  setIsSaving: (isSaving: boolean) => void;
  fadeAnim: React.MutableRefObject<Animated.Value>;
  autoScroll: boolean;
  setAutoScroll: (autoScroll: boolean) => void;
  navigation: any;
  stopAutoScroll: () => void;
}
export const PathControls = ({
  handleGoBack,
  setIsSaving,
  fadeAnim,
  autoScroll,
  setAutoScroll,
  navigation,
  stopAutoScroll,
}: Props) => {
  return (
    <>
      <NavContent navIcon={<HomeIcon />} onPress={() => handleGoBack()} />
      <NavContent
        navIcon={<SaveIcon />}
        onPress={() => {
          stopAutoScroll();
          setIsSaving(true);
          fadeAnim.current.setValue(1);
        }}
      />
      <NavContent
        navIcon={autoScroll ? <PauseIcon /> : <PlayIcon />}
        onPress={() => {
          setAutoScroll(!autoScroll);
        }}
      />
      <NavContent navIcon={<SettingsIcon />} onPress={() => navigation.push('Setting')} />
    </>
  );
};
