import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { SimpleText } from '../index';
import { LarivaarStyles } from '@styles';
import { Switch } from '@rneui/themed';
import { useLocal } from '../../hooks/useLocal';
import { showErrorAlert } from '@utils/Error';

export const Larivaar = () => {
  const [isLarivaar, setIsLarivaar] = useState<boolean>(false);
  const { saveLarivaar, fetchLarivaar } = useLocal();

  const handleLarivaar = async (larivaar: boolean) => {
    try {
      setIsLarivaar(larivaar);
      await saveLarivaar(larivaar);
    } catch (error) {
      console.error('Error saving larivaar setting:', error);
      showErrorAlert('Failed to save your Larivaar preference.');
      setIsLarivaar(!larivaar);
    }
  };

  useEffect(() => {
    const fetchFromLocal = async () => {
      try {
        const larivaar = await fetchLarivaar();
        setIsLarivaar(larivaar || false);
      } catch (error) {
        console.error('Error fetching larivaar setting:', error);
        showErrorAlert('Failed to load your Larivaar preference.');
      }
    };
    fetchFromLocal();
  }, [fetchLarivaar]);

  return (
    <View style={LarivaarStyles.container}>
      <SimpleText simpleText={'Larivaar'} simpleTextStyle={LarivaarStyles.fontSizeText} />
      <Switch
        value={isLarivaar}
        onValueChange={handleLarivaar}
        trackColor={{
          false: 'rgb(194, 194, 194)',
          true: 'rgba(17, 51, 106, 0.46)',
        }}
        thumbColor={isLarivaar ? 'rgb(17, 51, 106)' : 'rgb(142, 142, 142)'}
        accessibilityLabel="Larivaar setting"
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${isLarivaar ? 'disable' : 'enable'} Larivaar mode`}
        accessibilityState={{ checked: isLarivaar }}
      />
    </View>
  );
};
