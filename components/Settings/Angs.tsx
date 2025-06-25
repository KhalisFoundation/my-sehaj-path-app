import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ListItem, Overlay } from '@rneui/themed';
import { NavContent } from '@components/NavContent';
import { SimpleText } from '@components/SimpleText';
import { AngsFormatArray } from '@constants/Angs';
import { AngsFormat, useLocal } from '@hooks/useLocal';
import { LeftArrowIcon } from '@icons/LeftArrow.icon';
import { RightChevronIcon } from '@icons/RightChevron.icon';
import { AngsFormatStyles } from '@styles/AngsFormatStyles';

export const Angs = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [angsFormat, setAngsFormat] = useState<AngsFormat>({ format: 'Punjabi' });
  const { saveAngsFormat, fetchAngsFormat } = useLocal();
  const handleToggle = () => setIsVisible(!isVisible);
  const handleAngsFormat = (format: AngsFormat) => {
    setAngsFormat(format);
    saveAngsFormat(format);
    handleToggle();
  };
  useEffect(() => {
    const fetchFromLocal = async () => {
      const format = await fetchAngsFormat();
      setAngsFormat(format);
    };
    fetchFromLocal();
  }, [fetchAngsFormat]);
  return (
    <>
      <TouchableOpacity onPress={handleToggle} style={AngsFormatStyles.container}>
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
                <ListItem key={index} onPress={() => handleAngsFormat(format)}>
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
