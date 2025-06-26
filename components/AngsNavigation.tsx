import { View, Text, TouchableOpacity, TextInput, Pressable } from 'react-native';
import React, { useState } from 'react';
import { AngsNavigationStyle } from '@styles/AngsNavigation';
import { BlurView } from '@react-native-community/blur';
import { CrossIcon } from '@icons/Cross.icon';
import { LeftArrowIcon } from '@icons/LeftArrow.icon';
import { RightArrowIcon } from '@icons/RightArrow.icon';

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

  const handleAngNumber = (number: string) => {
    setInputValue(number);

    // Allow empty input
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

  const isGoButtonDisabled = !isValid || inputValue === '';

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
          >
            <CrossIcon />
          </Pressable>
          <Text style={AngsNavigationStyle.angsNavigationText}>Angs Navigation:</Text>
          <View style={AngsNavigationStyle.angsNavigationInputContainer}>
            <TouchableOpacity
              onPress={() => {
                handleLeftArrow();
                setIsAngsNavigationVisible(false);
              }}
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
            />
            <TouchableOpacity
              onPress={() => {
                handleRightArrow();
                setIsAngsNavigationVisible(false);
              }}
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
            onPress={() => {
              if (!isGoButtonDisabled) {
                fetchAngData(angNumber);
                setIsAngNavigation(true);
                setIsAngsNavigationVisible(false);
                setAngNavigationNumber(angNumber);
                updatePathAng(angNumber);
              }
            }}
            disabled={isGoButtonDisabled}
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
