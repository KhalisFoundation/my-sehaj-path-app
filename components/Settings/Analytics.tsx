import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Switch } from '@rneui/themed';
import { SimpleText } from '@components';
import { useLocal } from '@hooks';
import { showErrorAlert, trackSettingEvent } from '@utils';
import { LarivaarStyles } from '@styles';
import { ErrorConstants } from '@constants';

export const Analytics = () => {
  const [isAnalytics, setIsAnalytics] = useState<boolean>(true);
  const { saveConsent, fetchConsent } = useLocal();

  const handleAnalytics = async (analytics: boolean) => {
    try {
      if (isAnalytics) {
        trackSettingEvent(
          'click',
          `changed collect analytics to ${analytics ? 'enabled' : 'disabled'}`
        );
      }
      setIsAnalytics(analytics);
      await saveConsent(analytics);
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_ANALYTICS);
      setIsAnalytics(!analytics);
    }
  };

  useEffect(() => {
    const fetchFromLocal = async () => {
      try {
        const analytics = await fetchConsent();
        setIsAnalytics(analytics);
      } catch (error) {
        setIsAnalytics(true);
      }
    };
    fetchFromLocal();
  }, [fetchConsent]);

  return (
    <View style={LarivaarStyles.container}>
      <SimpleText simpleText={'Collect Analytics'} simpleTextStyle={LarivaarStyles.fontSizeText} />
      <Switch
        value={isAnalytics}
        onValueChange={handleAnalytics}
        trackColor={{
          false: 'rgb(194, 194, 194)',
          true: 'rgba(17, 51, 106, 0.46)',
        }}
        thumbColor={isAnalytics ? 'rgb(17, 51, 106)' : 'rgb(142, 142, 142)'}
        accessibilityLabel="Collect Analytics"
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${isAnalytics ? 'disable' : 'enable'} collect analytics`}
        accessibilityState={{ checked: isAnalytics }}
      />
    </View>
  );
};
