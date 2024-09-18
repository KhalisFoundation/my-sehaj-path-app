import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, LinearGradient, Stop, Defs } from 'react-native-svg';
import {typography, applyTypography } from '../styles/typography';

const ProgressCard = ({ sehajNumber, angNumber, progress }) => {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const { width } = dimensions;
  const cardWidth = width * 0.6;
  const cardHeight = cardWidth * 1.2;
  const size = cardWidth * 0.5;
  const strokeWidth = size * 0.13;
  const center = size / 2;
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const dynamicStyles = StyleSheet.create({
    container: {
      width: cardWidth,
      height: cardHeight,
      backgroundColor: 'white',
      borderRadius: cardWidth * 0.07,
      padding: cardWidth * 0.07,
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    textContainer: {
      alignItems: 'center',
      marginBottom: cardHeight * 0.10,
    },
    sehajText: applyTypography({
      fontSize: cardWidth * 0.12,
      fontWeight: '800',
      lineHeight: cardWidth * 0.17,
      textAlign: 'center',
      color: '#11336A',
    }),
    angText: applyTypography({
      fontSize: cardWidth * 0.09,
      fontWeight: '690',
      lineHeight: cardWidth * 0.13,
      textAlign: 'center',
      color: '#666666',
    }),
    angNumber: applyTypography({
      fontWeight: '720',
      color: '#11336A',
    }),
    progressContainer: {
      width: cardWidth * 0.6,
      height: cardWidth * 0.6,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: cardHeight * 0.05,
    },
  });

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.textContainer}>
        <Text style={dynamicStyles.sehajText}>Sehaj #{sehajNumber}</Text>
        <Text style={dynamicStyles.angText}>
          Ang <Text style={dynamicStyles.angNumber}>{angNumber}</Text>
        </Text>
      </View>
      <View style={dynamicStyles.progressContainer}>
      <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2459AD" stopOpacity="1" />
              <Stop offset="1" stopColor="#0D2346" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Circle
            stroke="#E0E0E0"
            fill="none"
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <Circle
            stroke="url(#grad)"
            fill="none"
            cx={center}
            cy={center}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
      </View>
    </View>
  );
};

export default ProgressCard;