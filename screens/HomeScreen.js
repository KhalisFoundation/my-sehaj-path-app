import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ProgressCircle from '../components/ProgressCircle';

function HomeScreen() {
  const navigation = useNavigation();
  const [currentPath, setCurrentPath] = useState(null);

  useEffect(() => {
    // Load current path progress from storage or API
    // This is a placeholder, implement actual loading logic
    setCurrentPath({
      id: 14,
      title: 'Sehaj #14',
      currentAng: 745,
      progress: 54 // Note: ProgressCircle expects a value from 0 to 100
    });
  }, []);

  const startNewPath = () => {
    // Start a new path from Ang 1
    navigation.navigate('PathScreen', { ang: 1 });
  };

  const continuePath = () => {
    if (currentPath) {
      navigation.navigate('PathScreen', { ang: currentPath.currentAng });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>It's a fine day to start a new Sehaj Path!</Text>
        <TouchableOpacity style={styles.startButton} onPress={startNewPath}>
          <Text style={styles.startButtonText}>START</Text>
        </TouchableOpacity>
        <Text style={styles.subheader}>Sehaj Path in Progress:</Text>
        {currentPath && (
          <View style={styles.sehajPathCard}>
            <Text style={styles.sehajPathTitle}>{currentPath.title}</Text>
            <Text style={styles.sehajPathSubtitle}>Ang {currentPath.currentAng}</Text>
            <ProgressCircle progress={currentPath.progress} size={120} strokeWidth={12} />
            <TouchableOpacity style={styles.continueButton} onPress={continuePath}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#1E3A8A',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 30,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  subheader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sehajPathCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  sehajPathTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  sehajPathSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 10,
  },
  continueButton: {
    backgroundColor: '#1E3A8A',
    padding: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default HomeScreen;
