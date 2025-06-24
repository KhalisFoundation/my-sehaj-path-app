import { View } from 'react-native';
import React from 'react';
import { SimpleText } from '../index';
import { AkhandPathStyles } from '@styles';
import { Switch } from '@rneui/themed';
import { useState, useEffect } from 'react';
import { useLocal } from '../../hooks/useLocal';

export const AkhandPath = () => {
  const [isAkhandPath, setIsAkhandPath] = useState<boolean>(false);
  const { saveAkhandPath, fetchAkhandPath } = useLocal();
  const handleAkhandPath = (akhandPath: boolean) => {
    setIsAkhandPath(akhandPath);
    saveAkhandPath(akhandPath);
  };
  useEffect(() => {
    const fetchFromLocal = async () => {
      const akhandPath = await fetchAkhandPath();
      setIsAkhandPath(akhandPath || false);
    };
    fetchFromLocal();
  }, [fetchAkhandPath]);
  return (
    <View style={AkhandPathStyles.container}>
      <SimpleText simpleText={'Akhand Path'} simpleTextStyle={AkhandPathStyles.fontSizeText} />
      <Switch
        value={isAkhandPath}
        onValueChange={handleAkhandPath}
        trackColor={{
          false: 'rgb(194, 194, 194)',
          true: 'rgba(17, 51, 106, 0.46)',
        }}
        thumbColor={isAkhandPath ? 'rgb(17, 51, 106)' : 'rgb(142, 142, 142)'}
      />
    </View>
  );
};
