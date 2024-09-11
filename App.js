import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import PathScreen from './App/screens/PathScreen';
import ProgressCard from './App/components/ProgressCard';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Path" component={PathScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeScreen({ navigation }) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>It's a fine day to start a new Sehaj Path!</Text>
      <TouchableOpacity style={styles.startButton} onPress={() => navigation.navigate('Path')}>
        <Text style={styles.startButtonText}>START</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Sehaj Path in Progress:</Text>
      <View style={styles.progressContainer}>
        <ProgressCard sehajNumber={14} angNumber={745} progress={75} />
      </View>
    
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  startButton: {
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 20,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  progressContainer: {
    marginBottom: 20,
  },
  completedContainer: {
    marginBottom: 20,
  },
});