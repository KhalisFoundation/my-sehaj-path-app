import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { BlurView } from '@react-native-community/blur';
import { AngsNavigationStyle } from '@styles/AngsNavigation';
import { CrossIcon, LeftArrowIcon, RightArrowIcon } from '@icons';
import { PATH_DATA } from '@constants';

interface Props {
  setIsAngsNavigationVisible: (isAngsNavigationVisible: boolean) => void;
  handleRightArrow: () => void;
  handleLeftArrow: () => void;
  pathAng: number;
  isAngNavigation: boolean;
  setIsAngNavigation: (isAngNavigation: boolean) => void;
  /** True only when the requested ang was loaded successfully. */
  fetchAngData: (angNumber: number) => Promise<boolean>;
  updatePathAng: (angNumber: number) => void;
}

export const AngsNavigation = ({
  setIsAngsNavigationVisible,
  handleRightArrow,
  handleLeftArrow,
  pathAng,
  setIsAngNavigation,
  fetchAngData,
  updatePathAng,
}: Props) => {
  const [angNumber, setAngNumber] = useState<number>(pathAng);
  const [inputValue, setInputValue] = useState<string>(pathAng.toString());
  const [isValid, setIsValid] = useState<boolean>(true);
  useEffect(() => {
    setAngNumber(pathAng);
    setInputValue(pathAng.toString());
  }, [pathAng]);

  const isGoButtonDisabled = !isValid || inputValue === '';

  const handleAngNumber = (number: string) => {
    setInputValue(number);

    if (number === '') {
      setIsValid(true);
      return;
    }
    const parsedNumber = parseInt(number, 10);
    if (isNaN(parsedNumber) || parsedNumber > PATH_DATA.LAST_ANG_NUMBER || parsedNumber < 1) {
      setIsValid(false);
      return;
    }
    setIsValid(true);
    setAngNumber(parsedNumber);
  };

  const handleNavigation = (navigationFunction: () => void) => {
    navigationFunction();
    setIsAngsNavigationVisible(false);
  };

  const handleGoToAng = async () => {
    if (isGoButtonDisabled) {
      return;
    }

    // The local DB is tried first. If it is unavailable, `fetchAngData` tries
    // the API and performs the offline handling. Do not update the reader's
    // displayed Ang unless one of those sources actually loaded it.
    const loaded = await fetchAngData(angNumber);
    if (!loaded) {
      return;
    }
    setIsAngNavigation(true);
    setIsAngsNavigationVisible(false);
    updatePathAng(angNumber);
  };

  return (
    <View style={AngsNavigationStyle.blurView}>
      <BlurView
        blurType="light"
        blurAmount={2}
        reducedTransparencyFallbackColor="rgba(0, 0, 0, 0.3)"
        style={StyleSheet.absoluteFill}
      />
      <View style={AngsNavigationStyle.overlayContainer}>
        <View style={AngsNavigationStyle.angsNavigationContainer}>
          <Pressable
            style={AngsNavigationStyle.crossIcon}
            onPress={() => setIsAngsNavigationVisible(false)}
            accessibilityLabel="Close angs navigation"
            accessibilityRole="button"
            accessibilityHint="Tap to close angs navigation dialog"
          >
            <CrossIcon />
          </Pressable>
          <Text style={AngsNavigationStyle.angsNavigationText}>Angs Navigation:</Text>
          <View style={AngsNavigationStyle.angsNavigationInputContainer}>
            <TouchableOpacity
              onPress={() => handleNavigation(handleLeftArrow)}
              accessibilityLabel="Previous ang"
              accessibilityRole="button"
              accessibilityHint="Tap to go to previous ang"
            >
              <LeftArrowIcon />
            </TouchableOpacity>
            <TextInput
              allowFontScaling={false}
              style={AngsNavigationStyle.input}
              placeholder="Enter Ang Number"
              placeholderTextColor={'grey'}
              autoFocus={false}
              value={inputValue}
              onChangeText={handleAngNumber}
              keyboardType="numeric"
              accessibilityLabel="Ang number input field"
              accessibilityHint={`Enter an ang number between 1 and ${PATH_DATA.LAST_ANG_NUMBER}`}
            />
            <TouchableOpacity
              onPress={() => handleNavigation(handleRightArrow)}
              accessibilityLabel="Next ang"
              accessibilityRole="button"
              accessibilityHint="Tap to go to next ang"
            >
              <RightArrowIcon />
            </TouchableOpacity>
          </View>
          {!isValid && inputValue !== '' && (
            <Text style={AngsNavigationStyle.warningText}>
              Please enter a valid Ang number between 1 and {PATH_DATA.LAST_ANG_NUMBER}
            </Text>
          )}
          <TouchableOpacity
            style={[
              AngsNavigationStyle.goButton,
              isGoButtonDisabled && AngsNavigationStyle.disabledButton,
            ]}
            onPress={handleGoToAng}
            disabled={isGoButtonDisabled}
            accessibilityLabel="Go to ang"
            accessibilityRole="button"
            accessibilityHint={`Tap to navigate to ang ${angNumber}`}
            accessibilityState={{ disabled: isGoButtonDisabled }}
          >
            <Text
              style={[
                AngsNavigationStyle.buttonText,
                isGoButtonDisabled && AngsNavigationStyle.disabledButtonText,
              ]}
            >
              Go
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
