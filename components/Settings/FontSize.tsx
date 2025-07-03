import { View, TouchableOpacity } from 'react-native';
import React, { useEffect, useState } from 'react';
import { FontSizeStyle } from '@styles';
import { ListItem, Overlay } from '@rneui/themed';
import { NavContent, SimpleText } from '../index';
import { FontSizes } from '@constants';
import { RightChevronIcon, LeftArrowIcon, CheckMarkIcon } from '@icons';
import { useLocal, FontSizeData } from '../../hooks/useLocal';
import { showErrorAlert } from '@utils/Error';

export const FontSize = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<FontSizeData>({
    fontSize: 'Small (Default)',
    number: 18,
  });
  const handleToggle = () => setIsVisible(!isVisible);
  const { saveFontSize, fetchFontSize } = useLocal();

  const handleFontSize = async (size: FontSizeData) => {
    try {
      setFontSize(size);
      handleToggle();
      await saveFontSize(size);
    } catch (error) {
      console.error('Error saving font size:', error);
      showErrorAlert('Failed to save your font size preference.');
      setFontSize(fontSize);
    }
  };

  useEffect(() => {
    const fetchFromLocal = async () => {
      try {
        const fontSizeData = await fetchFontSize();
        setFontSize(fontSizeData);
      } catch (error) {
        console.error('Error fetching font size:', error);
        showErrorAlert('Failed to load your font size preference.');
      }
    };
    fetchFromLocal();
  }, [fetchFontSize]);

  return (
    <>
      <TouchableOpacity
        style={FontSizeStyle.container}
        onPress={handleToggle}
        accessibilityLabel={`Font size setting, currently ${fontSize.fontSize}`}
        accessibilityRole="button"
        accessibilityHint="Tap to change font size"
      >
        <SimpleText simpleText={'Font-Size'} simpleTextStyle={FontSizeStyle.fontSizeText} />
        <View style={FontSizeStyle.fontSizeContainer}>
          <SimpleText
            simpleText={fontSize.fontSize || 'Default'}
            simpleTextStyle={FontSizeStyle.text}
          />
          <RightChevronIcon />
        </View>
      </TouchableOpacity>

      {isVisible && (
        <Overlay
          isVisible={isVisible}
          onBackdropPress={handleToggle}
          overlayStyle={FontSizeStyle.overlayContainer}
        >
          <View>
            <View style={FontSizeStyle.overlayHeader}>
              <NavContent navIcon={<LeftArrowIcon />} onPress={() => handleToggle()} />
              <NavContent text={'Select you Font Size'} />
            </View>
            <View style={FontSizeStyle.overlayContent}>
              {FontSizes.map((size: FontSizeData, index: number) => (
                <ListItem
                  onPress={() => handleFontSize(size)}
                  key={index}
                  accessibilityLabel={`Font size option: ${size.fontSize}`}
                  accessibilityRole="button"
                  accessibilityHint={`Tap to select ${size.fontSize} font size`}
                  accessibilityState={{ selected: fontSize.fontSize === size.fontSize }}
                >
                  <ListItem.Content style={FontSizeStyle.overlayTextContainer}>
                    <ListItem.Title style={FontSizeStyle.overlayText}>
                      {size.fontSize}
                    </ListItem.Title>
                    {fontSize.fontSize === size.fontSize && <CheckMarkIcon />}
                  </ListItem.Content>
                </ListItem>
              ))}
            </View>
          </View>
        </Overlay>
      )}
    </>
  );
};
