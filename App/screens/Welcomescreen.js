import React from 'react';
import { StyleSheet, View, ImageBackground, Text } from 'react-native';


export default function AppTro() {

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/image1.png')}
        style={styles.backgroundImage}
      >
        <View style={styles.blueRectangle}>
          <Text style={styles.welcometitle}>ਸਹਿਜ ਪਾਠ</Text>
          <Text style={styles.welcometext}>Building the habit</Text>
          <Text style={styles.welcometext}>of reading Gurbani</Text>

        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
    justifyContent: 'center',
    alignItems: 'center',
  },
  blueRectangle: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#0D2346',
    opacity: 0.93,
    justifyContent: 'center',
    alignItems: 'center',

  },
  welcometitle: {

    fontSize: 50,
    color: 'white',
    textAlign: 'center',
    fontFamily: 'BalooPaaji2-Bold',



  },
  welcometext: {
    fontFamily: 'BalooPaaji2-Regular',
    fontSize: 25,
    color: 'white',
    textAlign: 'center',


  },
});
