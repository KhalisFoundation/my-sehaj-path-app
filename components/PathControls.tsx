import React from 'react';
import { NavContent } from '@components';
import { SaveIcon, SettingsIcon, HomeIcon } from '@icons';
import { Animated } from 'react-native';

interface Props {
  handleGoBack: () => void;
  setIsSaving: (isSaving: boolean) => void;
  fadeAnim: React.MutableRefObject<Animated.Value>;
  navigation: any;
}
export const PathControls = ({ handleGoBack, setIsSaving, fadeAnim, navigation }: Props) => {
  return (
    <>
      <NavContent navIcon={<HomeIcon />} onPress={() => handleGoBack()} />
      <NavContent
        navIcon={<SaveIcon width={26} height={26} />}
        onPress={() => {
          setIsSaving(true);
          fadeAnim.current.setValue(1);
        }}
      />
      <NavContent navIcon={<SettingsIcon />} onPress={() => navigation.push('Setting')} />
    </>
  );
};
