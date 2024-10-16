import React,{useState,useEffect} from 'react';
import { StyleSheet, View, ImageBackground, Text, Button } from 'react-native';
import * as Font from 'expo-font';
export default function AppTro() {
  const [isFontLoaded, setIsFontLoaded] = useState(false);
   useEffect(() => {
    async function loadFont() {
      await Font.loadAsync({
        'BalooPaaji2-Bold': require('../assets/fonts/BalooPaaji2-Bold.ttf'),
        'BalooPaaji2-Medium': require('../assets/fonts/BalooPaaji2-Medium.ttf'),
         });
      setIsFontLoaded(true);
    }
    loadFont();
  }, []);
  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/image1.png')}
        style={styles.backgroundImage}
      >
        <View style={styles.blueRectangle}>
          <Text style={[styles.welcometitle , isFontLoaded && { fontFamily: 'BalooPaaji2-Bold' }]}>ਸਹਿਜ ਪਾਠ</Text>
          <Text style={[styles.welcometext,isFontLoaded && { fontFamily: 'BalooPaaji2-Medium'}]}>Building the habit</Text>
          <Text style={styles.welcometext}>of reading Gurbani</Text>
          </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    },
  backgroundImage: {
    flex: 1,
    width: '100%',
    
   },
  blueRectangle: {
    flex:1,
    width:'100%',
    justifyContent:"center",
    backgroundColor: '#0D2346',
    opacity: 0.93,
   },
  welcometitle: {
    fontSize: 50,
    color: 'white',
    textAlign: 'center',
    
  },
  welcometext: {
    fontSize: 25,
    color: 'white',
    textAlign: 'center',
  },
});
