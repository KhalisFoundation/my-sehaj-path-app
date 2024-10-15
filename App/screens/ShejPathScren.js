import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView } from 'react-native';
import { fetchVerses } from '../api/api';
import { typography } from '../styles/typography';
import Icon from 'react-native-vector-icons/Ionicons';

const SahejPathScreen = () => {
  const [verses, setVerses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadVerses(currentPage);
  }, [currentPage]);

  const loadVerses = async (page) => {
    setLoading(true);
    try {
      const fetchedVerses = await fetchVerses(page);
      setVerses(fetchedVerses);
    } catch (error) {
      console.error('Error loading verses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prevPage => prevPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < 1430) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={handlePreviousPage} style={styles.navButton}>
          <Icon name="chevron-back-outline" size={24} color="#11336A" />
        </Pressable>
        <Text style={styles.pageNumber}>{currentPage}</Text>
        <Pressable onPress={handleNextPage} style={styles.navButton}>
          <Icon name="chevron-forward-outline" size={24} color="#11336A" />
        </Pressable>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {loading ? (
          <Text style={styles.loadingText}>Loading...</Text>
        ) : (
          verses.map((verse, index) => (
            <Text key={index} style={styles.verseText}>{verse}</Text>
          ))
        )}
      </ScrollView>
      <View style={styles.navigationBar}>
        <Pressable style={styles.navButton}>
          <Icon name="home-outline" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.navButton}>
          <Icon name="bookmark-outline" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.navButton}>
          <Icon name="play-outline" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable style={styles.navButton}>
          <Icon name="settings-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 10,
  },
  pageNumber: {
    ...typography.balooMedium,
    fontSize: 18,
    color: '#11336A',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    paddingBottom: 70,
  },
  verseText: {
    ...typography.balooMedium,
    fontSize: 18,
    lineHeight: 28,
    color: '#000000',
    marginBottom: 10,
  },
  loadingText: {
    ...typography.balooMedium,
    fontSize: 18,
    color: '#11336A',
    textAlign: 'center',
    marginTop: 20,
  },
  navigationBar: {
    position: 'absolute',
    width: 258,
    height: 48,
    left: 67,
    bottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#11336A',
    borderRadius: 5,
  },
  navButton: {
    padding: 10,
  },
});

export default SahejPathScreen;
