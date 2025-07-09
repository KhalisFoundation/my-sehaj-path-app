import React from 'react';
import { View, ScrollView, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SimpleText, NavContent } from '@components';
import { GoBackIcon, HomeIcon } from '@icons';
import { ErrorScreenStyles } from '@styles';
import { RootStackParamList } from '../App';
import { ErrorConstants } from '@constants';

export const Error = ({ navigation }: NativeStackScreenProps<RootStackParamList, 'Error'>) => {
  return (
    <ScrollView contentContainerStyle={ErrorScreenStyles.container}>
      <Image
        source={require('../assets/Images/BaniDB.png')}
        style={ErrorScreenStyles.BaniDBImage}
      />
      <SimpleText
        simpleText={ErrorConstants.WE_ARE_CURRENTLY_FACING_ISSUE_BANIDB}
        simpleTextStyle={ErrorScreenStyles.textStyle}
      />
      <View style={ErrorScreenStyles.navContainer}>
        <NavContent
          navIcon={<GoBackIcon />}
          onPress={() => {
            navigation.goBack();
          }}
        />
        <View style={ErrorScreenStyles.HomeIconContainer}>
          <NavContent
            navIcon={<HomeIcon />}
            onPress={() => {
              navigation.replace('Home');
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
};
