import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const SehajPathScreen = () => {
  
  const currentAng = 745;
  const completionPercentage = 54;
  const daysElapsed = 42;
  const averageAngPerDay = 4;
  const estimatedCompletionDate = '24th Jan, 2025';
  const streaks = ['complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete'];

  return (
    <View style={styles.container}> 
      <ImageBackground
        source={require('./images/image2.png')}
        style={styles.backgroundImage}
      >
       <View style={styles.contentContainer}> 
      
      <View style={styles.header}>
      <TouchableOpacity style={styles.backLinkContainer}>
          <Image 
            source={require('./images/Arrow1.png')}
            style={styles.backArrowIcon} 
          />
          <Text style={styles.backLink}>See all paths</Text>
        </TouchableOpacity>
      </View>

      {/* Main Section */}
      <Text style={styles.title}>Sehaj #14</Text>
      <Text style={styles.subText}>ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ ॥ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ ॥ 🙏</Text>

      {/* Progress Info */}
      <Text style={styles.progressText}>
        You are on ang number <Text style={styles.highlightBox}>{currentAng}</Text> and have completed{' '}
        <Text style={styles.highlightBox}>{completionPercentage}%</Text> of your Sri Sehaj Path.🎉
      </Text>
      <Text style={styles.detailsText}>
        You started this path <Text style={styles.highlight}>{daysElapsed} days ago.</Text>
        {'\n'}You average about <Text style={styles.highlight}>{averageAngPerDay} angs a day.{' '}</Text>
        With your current speed, you will complete this Sehaj Path on{' '}
        <Text style={styles.highlight}>{estimatedCompletionDate}.</Text> 🎯
      </Text>

      {/* Streak Chart */}
      <Text style={styles.streakLabel}>Here’s your streak chart so far: ⚡</Text>
      <View style={styles.streakChart}>
        {streaks.map((streak, index) => (
          <View
            key={index}
            style={[styles.streakBlock, { backgroundColor: streak === 'complete' ? '#00376b' : streak === 'half' ? '#11336A9E' : '#7D7D7D3B' }]}
          />
        ))}
      </View>

      {/* Continue Button */}
      <View style={{ flex: 1 }}> 
      <LinearGradient
        colors={['#274682', '#0C2340']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={styles.linearGradient}
      >
        <TouchableOpacity style={styles.continueButton}>
          <View style={styles.buttonContent}>
            <Image
              source={require('./images/play.png')} 
              style={styles.playIcon}
            />
            <Text style={styles.continueButtonText}>Continue</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>
      </View>
      </View>
    </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  linearGradient: {
    paddingVertical: 12,
    borderRadius: 10, 
    width: 150, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover', 
    justifyContent: 'center',
    alignItems: 'center',
    
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  backLinkContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
  },
  backArrowIcon: {
    width: 26, 
    height: 20,
    marginRight: 12,   },
  backLink: {
    fontSize: 18,
    color: '#11336A',
    textDecorationLine: 'none',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 20,
    color: '#00376b',
    fontFamily:'HvDTrial_Brandon_Grotesque_regular-BF64a625c9311e1'
  },
  subText: {
    fontSize: 18,
    color: '#11336A',
    marginBottom: 20,
    fontFamily:'BalooPaaji2-Bold'
  },
  progressText: {
    fontSize: 24,
    marginBottom: 10,
    lineHeight: 42,
    fontFamily:'BalooPaaji2-Regular'
  },
  highlight: {
    fontWeight: 'bold',
    color: '#00376b',
    
  },
  highlightBox: {
    fontWeight: 'bold',
    backgroundColor: '#FFE082', 
    paddingHorizontal: 8, 
    paddingRight:6,    
    borderRadius: 19, 
    color: '#00376b',
    
  },
  detailsText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    lineHeight: 28,
    fontFamily:'BalooPaaji2-Regular'
  },
  streakLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  streakChart: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 50,
  },
  streakBlock: {
    width: 15,
    height: 15,
    margin: 5,
    borderRadius: 4,
  },
  continueButton: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    width: '100%', 
  },
  buttonContent: {
    flexDirection: 'row', 
    alignItems: 'center', 
  },
  playIcon: {
    width: 30, 
    height: 30, 
    marginRight: 8, 
  },
  continueButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    fontFamily:'BalooPaaji2-Regular'
  },
});

export default SehajPathScreen;
