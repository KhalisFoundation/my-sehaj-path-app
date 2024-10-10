import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import CircularProgress from 'react-native-circular-progress-indicator';

const ProgressCard = ({ sheajPathNumber, angNumber, progress }) => {
  const { width: screenWidth } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      width: screenWidth < 768 ? 199 : 239,
      height: screenWidth < 768 ? 220 : 264,
      backgroundColor: 'white',
      borderRadius: 15,
      padding: screenWidth < 768 ? 20 : 24,
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#11336A1A',
      shadowOffset: { width: 15, height: 15 },
      shadowOpacity: 0.7,
      shadowRadius: 45,
      elevation: 15,
    },
    textContainer: {
      alignItems: 'center',
      marginBottom: screenWidth < 768 ? 2 : 4,
    },
    sehajText: {
      fontFamily: 'BrandonGrotesque-Bold',
      fontSize: screenWidth < 768 ? 18 : 22,
      lineHeight: screenWidth < 768 ? 26 : 31,
      textAlign: 'center',
      color: '#11336A',
    },
    angText: {
      fontFamily: 'BrandonGrotesque-Regular',
      fontSize: screenWidth < 768 ? 14 : 17,
      lineHeight: screenWidth < 768 ? 20 : 24,
      textAlign: 'center',
      color: '#666666',
    },
    angNumber: {
      fontFamily: 'BrandonGrotesque-Bold',
      color: '#11336A',
    },
    progressContainer: {
      width: screenWidth < 768 ? 53 : 72,
      height: screenWidth < 768 ? 53 : 72,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 'auto',
      borderRadius: 50,
      marginBottom: 'auto',
      shadowColor: '#0D2346',
      shadowOffset: { width: 5, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 3.75,
      elevation: 5,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.sehajText}>Sehaj #{sheajPathNumber}</Text>
        <Text style={styles.angText}>
          Ang <Text style={styles.angNumber}>{angNumber}</Text>
        </Text>
      </View>
      <View style={styles.progressContainer}>
        <CircularProgress
          value={progress}
          radius={screenWidth < 768 ? 26.5 : 36}
          duration={0}
          maxValue={100}
          showProgressValue={false}
          activeStrokeColor={'#2459AD'}
          activeStrokeSecondaryColor={'#0D2346'}
          inActiveStrokeColor={'rgba(36, 89, 173, 0.1)'}
          inActiveStrokeOpacity={1}
          inActiveStrokeWidth={screenWidth < 768 ? 12 : 14}
          activeStrokeWidth={screenWidth < 768 ? 12 : 14}
          strokeLinecap="round"
          progressValueStyle={{ display: 'none' }}
          dashedStrokeConfig={{
            count: 0,
            width: screenWidth < 768 ? 12 : 14,
          }}
          circleBackgroundColor="transparent"
        />
      </View>
    </View>
  );
};

export default ProgressCard;