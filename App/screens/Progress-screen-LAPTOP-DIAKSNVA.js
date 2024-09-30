import React,{useState,useEffect} from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Font from 'expo-font';
 


const SehajPathScreen = () => {
  const [isFontLoaded, setIsFontLoaded] = useState(false);

  useEffect(() => {
    async function loadFont() {
      await Font.loadAsync({
        'BalooPaaji2-Bold': require('../assets/fonts/BalooPaaji2-Bold.ttf'),
        'BalooPaaji2-Regular': require('../assets/fonts/BalooPaaji2-Regular.ttf'),
        'brandon-grotesque-regular-italic-58a8a456c4724':require('../assets/fonts/brandon-grotesque-regular-italic-58a8a456c4724.otf'), 
       });
      setIsFontLoaded(true);
    }

    loadFont();
  }, []);
  const currentAng = 745;
  const completionPercentage = 54;
  const daysElapsed = 42;
  const averageAngPerDay = 4;
  const estimatedCompletionDate = '24th Jan, 2025';
  const streaks = ['complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete','complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete','complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete','complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete','complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete','complete', 'complete', 'half', 'complete', 'complete', 'complete', 'incomplete'];

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
     
      <Text style={[styles.progressText,isFontLoaded && { fontFamily: 'BalooPaaji2-Regular' }]}>
        You are on ang number <Text style={styles.highlightBox}>{currentAng}</Text> and have completed{' '}
        <Text style={styles.highlightBox}>{completionPercentage}%</Text> of your Sri Sehaj Path.🎉
      </Text>
      <Text style={[styles.detailsText,isFontLoaded && { fontFamily: 'BalooPaaji2-Regular' }]}>
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
            style={[styles.streakBlock, { backgroundColor: streak === 'complete' ? '#00376b' : streak === 'half' ? '#11336A9E' : '#7D7D7D3B' }]}
          />
        ))}
      </View>
      <TouchableOpacity style={styles.continueButton}>
        <LinearGradient
          colors={['#00164d', '#0047ab']}
          style={styles.buttonContent}
        >
          <Image 
            source={require('../assets/play.png')} // Replace this with the appropriate play icon
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
  container: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: 'row', 
    paddingVertical: 10,
  },
  playIcon: {
    width: 20, 
    height: 20, 
    marginRight: 8, 
  },
  continueButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  linearGradient: {
    flex: 1,
    paddingLeft: 15,
    paddingRight: 15,
    borderRadius: 5
  },
  buttonText: {
    fontSize: 18,
    
    textAlign: 'center',
    margin: 10,
    color: '#ffffff',
    backgroundColor: 'transparent',
  },
  continueButton:{
    width:'95%',
    height:210,
    paddingHorizontal:10,
    borderRadius:35,
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover', 
    justifyContent: 'center',
    alignItems: 'center',
    
  },
  headercontainer:{
    width:'100%',
    marginTop:30,
    display:'flex',
    
    alignItems:'center',
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
    fontFamily:''
  },
  subText: {
    fontSize: 18,
    color: '#11336A',
    marginBottom: 20,
 
   
  },
  progressText: {
    fontSize: 24,
    marginBottom: 10,
    lineHeight: 42,
    // fontFamily:'BalooPaaji2-Regular',
    color:'#999999'
    
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
    color: '#999999',
    marginBottom: 20,
    lineHeight: 28,
    // fontFamily:'BalooPaaji2-Medium',
    
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
    paddingVertical:  8,
    borderRadius: 16,
    alignItems:'flex-start',
    width: '100%', 
    
  },
  buttonContent: {
    flexDirection: 'row', 
    alignItems: 'center',
    paddingVertical:  15,
    paddingHorizontal:16,
    borderRadius:5 
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
 
  },
});

export default SehajPathScreen;
