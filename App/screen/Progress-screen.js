import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Image, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Font from 'expo-font';

const Progressscreen = ({ route }) => {
  const [isFontLoaded, setIsFontLoaded] = useState(false);

  useEffect(() => {
    async function loadFont() {
      await Font.loadAsync({
        'BalooPaaji2-Bold': require('../assets/fonts/BalooPaaji2-Bold.ttf'),
        'BalooPaaji2-Regular': require('../assets/fonts/BalooPaaji2-Regular.ttf'),
        'brandon-grotesque-regular-italic-58a8a456c4724': require('../assets/fonts/brandon-grotesque-regular-italic-58a8a456c4724.ttf'),
      });
      setIsFontLoaded(true);
    }

    loadFont();
  }, []);

  // Access props data (with default values)
  const {
    currentAng = 745,
    completionPercentage = 54,
    daysElapsed = 42,
    averageAngPerDay = 4,
    estimatedCompletionDate = '24th Jan, 2025',
    streaks = ['complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete', 'complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete', 'complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete', 'complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete', 'complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete', 'complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete'],
  } = route.params || {};

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/image2.png')}
        style={styles.backgroundImage}
      >
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backLinkContainer}>
              <Image
                source={require('../assets/Arrow1.png')}
                style={styles.backArrowIcon}
              />
              <Text style={styles.backLink}>See all paths</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, isFontLoaded && { fontFamily: 'brandon-grotesque-regular-italic-58a8a456c4724' }]}>Sehaj #14</Text>
          <Text style={[styles.subText, isFontLoaded && { fontFamily: 'BalooPaaji2-Bold' }]}>
            ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ॥ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ ॥ 🙏
          </Text>

          <Text style={[styles.progressText, isFontLoaded && { fontFamily: 'BalooPaaji2-Regular' }]}>
            You are on ang number <Text style={styles.highlightBox}>{currentAng}</Text> and have completed{' '}
            <Text style={styles.highlightBox}>{completionPercentage}%</Text> of your Sri Sehaj Path.🎉
          </Text>
          <Text style={[styles.detailsText, isFontLoaded && { fontFamily: 'BalooPaaji2-Regular' }]}>
            You started this path <Text style={styles.highlight}>{daysElapsed} days ago.</Text>
            {'\n'}You average about <Text style={styles.highlight}>{averageAngPerDay} angs a day.{' '}</Text>
            With your current speed, you will complete this Sehaj Path on{' '}
            <Text style={styles.highlight}>{estimatedCompletionDate}.</Text> 🎯
          </Text>

          <Text style={styles.streakLabel}>Here’s your streak chart so far: ⚡</Text>
          <View style={styles.streakChart}>
            {streaks.map((streak, index) => (
              <View
                key={index}
                style={[
                  styles.streakBlock,
                  {
                    backgroundColor: streak === 'complete'
                      ? '#00376b'
                      : streak === 'half'
                        ? '#11336A9E'
                        : '#7D7D7D3B',
                  },
                ]}
              />
            ))}
          </View>

          {/* Continue Button with Shadow */}
          <TouchableOpacity style={styles.continueButton}>
            <LinearGradient
              colors={['#00164d', '#0047ab']}
              style={[styles.buttonContent, styles.buttonShadow]} 
            >
              <Image
                source={require('../assets/play.png')}
                style={styles.playIcon}
              />
              <Text style={styles.continueButtonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  // ... (your existing styles)

  // Drop Shadow Styles (add these)
  buttonShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5, 
      },
    }),
  },
});

export default Progressscreen;
