import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, TouchableOpacity } from 'react-native';
import { fetchVerses } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';

function HomeScreen() {
    const [pageNumber, setPageNumber] = useState(1);
    const [verses, setVerses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
  
    useEffect(() => {
      loadVerses(pageNumber);
    }, [pageNumber]);
  
    const loadVerses = async (page) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchVerses(page);
        setVerses(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
  
    const navigatePage = (direction) => {
      const newPage = pageNumber + direction;
      if (newPage >= 1 && newPage <= 1430) {
        setPageNumber(newPage);
      }
    };
  
    const renderVerse = ({ item }) => (
      <Text style={styles.verseText}>{item}</Text>
    );
  
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navigationButtons}>
          <TouchableOpacity onPress={() => navigatePage(-1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>ਪਿਛਲਾ</Text>
          </TouchableOpacity>
          <Text style={styles.pageNumber}>ang {pageNumber}</Text>
          <TouchableOpacity onPress={() => navigatePage(1)} style={styles.navButton}>
            <Text style={styles.navButtonText}>ਅਗਲਾ</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <SkeletonLoader />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <FlatList
            data={verses}
            renderItem={renderVerse}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={styles.scrollViewContent}
            ListHeaderComponent={<View style={styles.contentPadding} />}
          />
        )}
      </SafeAreaView>
    );
  }

export default HomeScreen;

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
    },
    navigationButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      backgroundColor: '#f0f0f0',
    },
    navButton: {
      padding: 10,
      backgroundColor: '#007AFF',
      borderRadius: 5,
    },
    navButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    pageNumber: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    scrollViewContent: {
      paddingBottom: 20,
    },
    contentPadding: {
      height: 20, // Adjust this value to increase or decrease the top padding
    },
    verseText: {
      fontSize: 18,
      marginBottom: 10,
      paddingHorizontal: 15,
      textAlign: 'left',
    },
    loadingText: {
      fontSize: 18,
      textAlign: 'center',
      marginTop: 20,
    },
    errorText: {
      fontSize: 18,
      textAlign: 'center',
      marginTop: 20,
      color: 'red',
    },
  });