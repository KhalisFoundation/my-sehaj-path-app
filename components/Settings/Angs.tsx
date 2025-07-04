import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ListItem, Overlay } from '@rneui/themed';
import { NavContent, SimpleText } from '@components';
import { AngsFormatArray } from '@constants';
import { AngsFormat, useLocal } from '@hooks/useLocal';
import { LeftArrowIcon, RightChevronIcon } from '@icons';
import { AngsFormatStyles } from '@styles';
import { showErrorAlert } from '@utils';
import { ErrorConstants } from '@constants';

export const Angs = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [angsFormat, setAngsFormat] = useState<AngsFormat>({ format: 'Punjabi' });
  const { saveAngsFormat, fetchAngsFormat } = useLocal();
  const handleToggle = () => setIsVisible(!isVisible);

  const handleAngsFormat = async (format: AngsFormat) => {
    try {
      setAngsFormat(format);
      handleToggle();
      await saveAngsFormat(format);
    } catch (error) {
      showErrorAlert(ErrorConstants.FAILED_TO_SAVE_ANG_FORMAT);
      setAngsFormat(angsFormat);
    }
  };

  useEffect(() => {
    const fetchFromLocal = async () => {
      try {
        const angsFormatData = await fetchAngsFormat();
        setAngsFormat(angsFormatData);
      } catch (error) {
        showErrorAlert(ErrorConstants.FAILED_TO_LOAD_ANG_FORMAT);
      }
    };
    fetchFromLocal();
  }, [fetchAngsFormat]);

  return (
    <>
      <TouchableOpacity
        onPress={handleToggle}
        style={AngsFormatStyles.container}
        accessibilityLabel={`Angs format setting, currently ${angsFormat.format}`}
        accessibilityRole="button"
        accessibilityHint="Tap to change angs format"
      >
        <SimpleText simpleText={'Angs'} simpleTextStyle={AngsFormatStyles.angsText} />
        <View style={AngsFormatStyles.angsContainer}>
          <SimpleText simpleText={angsFormat.format} simpleTextStyle={AngsFormatStyles.text} />
          <RightChevronIcon />
        </View>
      </TouchableOpacity>
      {isVisible && (
        <Overlay isVisible={isVisible} onBackdropPress={() => setIsVisible(false)}>
          <View style={AngsFormatStyles.overlayHeader}>
            <NavContent navIcon={<LeftArrowIcon />} onPress={() => handleToggle()} />
            <NavContent text={'Select you Angs Format'} />
          </View>
          <View>
            {AngsFormatArray.map((format: AngsFormat, index: number) => {
              return (
                <ListItem
                  key={index}
                  onPress={() => handleAngsFormat(format)}
                  accessibilityLabel={`Angs format option: ${format.format}`}
                  accessibilityRole="button"
                  accessibilityHint={`Tap to select ${format.format} format`}
                  accessibilityState={{ selected: angsFormat.format === format.format }}
                >
                  <ListItem.Content style={AngsFormatStyles.overlayTextContainer}>
                    <ListItem.Title style={AngsFormatStyles.overlayText}>
                      {format.format}
                    </ListItem.Title>
                  </ListItem.Content>
                </ListItem>
              );
            })}
          </View>
        </Overlay>
      )}
    </>
  );
};
