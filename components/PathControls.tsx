import React from 'react';
import { NavContent } from '@components';
import { SaveIcon, SettingsIcon, HomeIcon } from '@icons';
import { Animated, TouchableOpacity, View } from 'react-native';
import { PathScreenStyles } from '@styles';

interface Props {
  handleGoBack: () => void;
  setIsSaving: (isSaving: boolean) => void;
  fadeAnim: React.MutableRefObject<Animated.Value>;
  navigation: any;
}
export const PathControls = ({ handleGoBack, setIsSaving, fadeAnim, navigation }: Props) => {
  return (
    <>
      <View style={PathScreenStyles.controlsContainer}>
        <TouchableOpacity style={PathScreenStyles.controlItem} onPress={() => handleGoBack()}>
          <NavContent navIcon={<HomeIcon />} onPress={() => handleGoBack()} />
        </TouchableOpacity>
        <TouchableOpacity
          style={PathScreenStyles.controlItem}
          onPress={() => {
            setIsSaving(true);
            fadeAnim.current.setValue(1);
          }}
        >
          <NavContent
            navIcon={<SaveIcon width={26} height={26} />}
            onPress={() => {
              setIsSaving(true);
              fadeAnim.current.setValue(1);
            }}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={PathScreenStyles.controlItem}
          onPress={() => navigation.push('Setting')}
        >
          <NavContent navIcon={<SettingsIcon />} onPress={() => navigation.push('Setting')} />
        </TouchableOpacity>
      </View>
    </>
  );
};
