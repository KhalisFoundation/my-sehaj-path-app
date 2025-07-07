import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Pressable } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { AngsNavigationStyle } from '@styles/AngsNavigation';
import { CrossIcon, LeftArrowIcon, RightArrowIcon } from '@icons';
import { useInternet } from '@hooks';
import { showErrorAlert } from '@utils';
import { ErrorConstants } from '@constants';

interface Props {
  setIsAngsNavigationVisible: (isAngsNavigationVisible: boolean) => void;
  handleRightArrow: () => void;
  handleLeftArrow: () => void;
  angNavigationNumber: number;
  setAngNavigationNumber: (angNavigationNumber: number) => void;
  isAngNavigation: boolean;
  setIsAngNavigation: (isAngNavigation: boolean) => void;
  fetchAngData: (angNumber: number) => void;
  updatePathAng: (angNumber: number) => void;
}

export const AngsNavigation = ({
  setIsAngsNavigationVisible,
  handleRightArrow,
  handleLeftArrow,
  angNavigationNumber,
  setAngNavigationNumber,
  setIsAngNavigation,
  fetchAngData,
  updatePathAng,
}: Props) => {
  const [angNumber, setAngNumber] = useState<number>(angNavigationNumber);
  const [inputValue, setInputValue] = useState<string>(angNavigationNumber.toString());
  const [isValid, setIsValid] = useState<boolean>(true);
  const { checkNetwork } = useInternet();

  const isGoButtonDisabled = !isValid || inputValue === '';

  const handleAngNumber = (number: string) => {
    setInputValue(number);

    if (number === '') {
      setIsValid(true);
      return;
    }
    const parsedNumber = parseInt(number, 10);
    if (isNaN(parsedNumber) || parsedNumber > 1430 || parsedNumber < 1) {
      setIsValid(false);
      return;
    }
    setIsValid(true);
    setAngNumber(parsedNumber);
  };

  const handleNavigation = async (navigationFunction: () => void) => {
    try {
      const isConnected = await checkNetwork();
      if (!isConnected) {
        showErrorAlert(
          ErrorConstants.NO_INTERNET_TITLE + '\n' + ErrorConstants.NO_INTERNET_MESSAGE
        );
        return;
      }
      navigationFunction();
      setIsAngsNavigationVisible(false);
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_CHECK_NETWORK_CONNECTION);
    }
  };

  const handleGoToAng = async () => {
    if (isGoButtonDisabled) {
      return;
    }

    try {
      const isConnected = await checkNetwork();
      if (!isConnected) {
        showErrorAlert(
          ErrorConstants.NO_INTERNET_TITLE + '\n' + ErrorConstants.NO_INTERNET_MESSAGE
        );
        return;
      }
      fetchAngData(angNumber);
      setIsAngNavigation(true);
      setIsAngsNavigationVisible(false);
      setAngNavigationNumber(angNumber);
      updatePathAng(angNumber);
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_CHECK_NETWORK_CONNECTION);
    }
  };

  return (
    <BlurView
      blurType="light"
      blurAmount={1}
      reducedTransparencyFallbackColor="grey"
      style={AngsNavigationStyle.blurView}
    >
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
              style={AngsNavigationStyle.input}
              placeholder="Enter Ang Number"
              placeholderTextColor={'grey'}
              autoFocus={false}
              value={inputValue}
              onChangeText={handleAngNumber}
              keyboardType="numeric"
              accessibilityLabel="Ang number input field"
              accessibilityHint="Enter an ang number between 1 and 1430"
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
              Please enter a valid Ang number between 1 and 1430
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
    </BlurView>
  );
};
