import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Switch } from '@rneui/themed';
import { SimpleText } from '@components';
import { useLocal } from '@hooks';
import { showErrorAlert, trackEvent } from '@utils';
import { ErrorConstants, Constants } from '@constants';
import { ParagraphModeStyles } from '@styles/ParagraphModeStyles';

export const ParagraphMode = () => {
  const [isParagraphMode, setIsParagraphMode] = useState<boolean>(false);
  const { saveParagraphMode, fetchParagraphMode } = useLocal();

  const handleParagraphMode = async (paragraphMode: boolean) => {
    try {
      setIsParagraphMode(paragraphMode);
      trackEvent('Settings', 'click', `changed paragraph mode to ${paragraphMode ? 'enabled' : 'disabled'}`);
      await saveParagraphMode(paragraphMode);
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_PARAGRAPH_MODE);
      setIsParagraphMode(!paragraphMode);
    }
  };

  useEffect(() => {
    const fetchFromLocal = async () => {
      try {
        const paragraphMode = await fetchParagraphMode();
        setIsParagraphMode(paragraphMode || false);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_PARAGRAPH_MODE);
      }
    };
    fetchFromLocal();
  }, [fetchParagraphMode]);

  return (
    <View style={ParagraphModeStyles.container}>
      <SimpleText simpleText={Constants.PARAGRAPHMODE} simpleTextStyle={ParagraphModeStyles.fontSizeText} />
      <Switch
        value={isParagraphMode}
        onValueChange={handleParagraphMode}
        trackColor={{
          false: 'rgb(194, 194, 194)',
          true: 'rgba(17, 51, 106, 0.46)',
        }}
        thumbColor={isParagraphMode ? 'rgb(17, 51, 106)' : 'rgb(142, 142, 142)'}
        accessibilityLabel="Paragraph mode setting"
        accessibilityRole="switch"
        accessibilityHint={`Tap to ${isParagraphMode ? 'disable' : 'enable'} Paragraph mode`}
        accessibilityState={{ checked: isParagraphMode }}
      />
    </View>
  );
};
