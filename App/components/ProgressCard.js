import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path, LinearGradient, Stop, Defs } from 'react-native-svg';

const ProgressCard = ({ sheajPathNumber, angNumber, progress }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const styles = StyleSheet.create({
    container: {
      width: screenWidth < 768 ? 199 : 239,
      height: screenWidth < 768 ? 220 : 264,
      backgroundColor: 'white',
      borderRadius: 15,
      padding: screenWidth < 768 ? 20 : 24,
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
      marginBottom: 'auto',
    },
  });

  const size = screenWidth < 768 ? 53 : 72;
  const strokeWidth = screenWidth < 768 ? 12 : 14;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;

  const calculateArcPath = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) % 360) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const progressAngle = 360 * (progress / 100);
  const startAngle = 0; 
  const endAngle = progressAngle; 

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.sehajText}>Sehaj #{sheajPathNumber}</Text>
        <Text style={styles.angText}>
          Ang <Text style={styles.angNumber}>{angNumber}</Text>
        </Text>
      </View>
      <View style={styles.progressContainer}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="filledGrad" x1="16.15%" y1="85.35%" x2="85.35%" y2="16.15%">
              <Stop offset="0%" stopColor="#2459AD" />
              <Stop offset="100%" stopColor="#0D2346" />
            </LinearGradient>
            <LinearGradient id="unfilledGrad" x1="16.15%" y1="85.35%" x2="85.35%" y2="16.15%">
              <Stop offset="0%" stopColor="rgba(36, 89, 173, 0.1)" />
              <Stop offset="100%" stopColor="rgba(13, 35, 70, 0.1)" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#unfilledGrad)"
            strokeWidth={strokeWidth}
          />
          <Path
            d={calculateArcPath(center, center, radius, startAngle, endAngle)}
            fill="none"
            stroke="url(#filledGrad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
};

export default ProgressCard;