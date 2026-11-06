import React from 'react';
import { NavContent } from '@components';
import { SaveIcon, SettingsIcon, HomeIcon } from '@icons';
import { ReaderToolbar } from '@constants';
import { scaledIconSize, useAppIconScale } from '@icons/useAppIconScale';
import { Animated, TouchableOpacity, View } from 'react-native';
import { PathScreenStyles } from '@styles';
import { trackEvent } from '@utils';

interface Props {
  handleGoBack: () => void;
  setIsSaving: (isSaving: boolean) => void;
  fadeAnim: React.MutableRefObject<Animated.Value>;
  /** Opens Settings immediately, matching the legacy navigation behavior. */
  onSettings: () => void;
}
export const PathControls = ({ handleGoBack, setIsSaving, fadeAnim, onSettings }: Props) => {
  const iconScale = useAppIconScale();
  // These three icons are separate SVG assets with different viewboxes. Give
  // the reader toolbar one rendered box and one stroke weight so it reads as a
  // coherent control group rather than three unrelated icon sizes.
  const controlIconSize = scaledIconSize(ReaderToolbar.CONTROL_ICON_SIZE, iconScale);
  const controlIconStrokeWidth = ReaderToolbar.CONTROL_ICON_STROKE_WIDTH;
  // Both the TouchableOpacity and the NavContent inside it fire this, so it is
  // defined once rather than tracked in two inline handlers.
  const onSavePress = () => {
    trackEvent('PathProgress', 'click', 'save icon');
    setIsSaving(true);
    fadeAnim.current.setValue(1);
  };

  return (
    <>
      <View style={PathScreenStyles.controlsContainer}>
        <TouchableOpacity style={PathScreenStyles.controlItem} onPress={() => handleGoBack()}>
          <NavContent
            navIcon={
              <HomeIcon
                width={controlIconSize}
                height={controlIconSize}
                strokeWidth={controlIconStrokeWidth}
              />
            }
            onPress={() => handleGoBack()}
          />
        </TouchableOpacity>
        <TouchableOpacity style={PathScreenStyles.controlItem} onPress={onSavePress}>
          <NavContent
            navIcon={
              <SaveIcon
                width={controlIconSize}
                height={controlIconSize}
                strokeWidth={controlIconStrokeWidth}
              />
            }
            onPress={onSavePress}
          />
        </TouchableOpacity>
        <TouchableOpacity style={PathScreenStyles.controlItem} onPress={onSettings}>
          <NavContent
            navIcon={
              <SettingsIcon
                width={controlIconSize}
                height={controlIconSize}
                strokeWidth={controlIconStrokeWidth}
              />
            }
            onPress={onSettings}
          />
        </TouchableOpacity>
      </View>
    </>
  );
};
