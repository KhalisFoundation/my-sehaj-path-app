import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground } from 'react-native';
import Svg, { Rect, LinearGradient, Stop, Defs } from 'react-native-svg';
import ProgressCard from '../components/ProgressCard';
import { typography } from '../styles/typography';

const HomeScreen = () => {
    const inProgressPaths = [
        { number: 14, ang: 745, progress: 65 },
        { number: 15, ang: 1145, progress: 25 },
        { number: 16, ang: 500, progress: 40 },
        { number: 17, ang: 800, progress: 80 },
    ];

    const completedPaths = [
        { number: 11, date: "4th Aug 2024" },
        { number: 10, date: "13th Jan 2024" },
        { number: 9, date: "11th Oct 2023" },
    ];

    return (
        <ImageBackground 
            source={require('../assets/background.png')}
            style={styles.backgroundImage}
        >
            <ScrollView style={styles.container}>
                <Text style={styles.header}>It's a fine day to start a new Sehaj Path!</Text>

                <View style={styles.startButtonContainer}>
                    <TouchableOpacity style={styles.startButton}>
                        <Svg width={112} height={48}>
                            <Defs>
                                <LinearGradient id="buttonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <Stop offset="0%" stopColor="#11336A" />
                                    <Stop offset="100%" stopColor="#0D2346" />
                                </LinearGradient>
                            </Defs>
                            <Rect width={112} height={48} rx={24} ry={24} fill="url(#buttonGrad)" />
                        </Svg>
                        <View style={styles.startButtonContent}>
                            <Text style={styles.startButtonText}>START</Text>
                            <Image 
                                source={require('../assets/plus-waves.png')} 
                                style={styles.plusWaves}
                            />
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>Sehaj Path in Progress:</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {inProgressPaths.map((path, index) => (
                        <View key={index} style={styles.cardWrapper}>
                            <ProgressCard
                                sheajPathNumber={path.number}
                                angNumber={path.ang}
                                progress={path.progress}
                            />
                        </View>
                    ))}
                </ScrollView>

                <View style={styles.sectionTitleContainer}>
                    <Text style={styles.sectionTitle}>Sehaj Paths Completed:</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                    {completedPaths.map((path, index) => (
                        <View key={index} style={styles.completedCardWrapper}>
                            <View style={styles.completedCard}>
                                <Text style={styles.completedText}>Sehaj #{path.number}</Text>
                                <Text style={styles.completedAngText}>{path.date}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </ScrollView>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    backgroundImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    container: {
        flex: 1,
        backgroundColor: 'rgba(245, 245, 245, 0.1)', 
        padding: 20,
    },
    header: {
        ...typography.recoletaRegular,
        fontSize: 24,
        color: '#11336A',
        textAlign: 'center',
        marginBottom: 20,
        marginTop: 40,
        
    },
    startButtonContainer: {
        width: 112,
        height: 48,
        alignSelf: 'center',
        marginBottom: 30,
    },
    startButton: {
        width: 112,
        height: 48,
        backgroundColor: 'transparent',
    },
    startButtonContent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    startButtonText: {
        ...typography.balooRegular,
        color: 'white',
        fontSize: 16,
        marginRight: 5,
    },
    plusWaves: {
        width: 20,
        height: 20,
        marginLeft: 5,
    },
    sectionTitleContainer: {
        alignItems: 'center',
        marginBottom: 15,
        marginTop: 20,
    },
    sectionTitle: {
        fontFamily: 'BrandonGrotesque-Medium',
        fontSize: 14,
        fontWeight: '390',
        lineHeight: 20,
        textAlign: 'center',
        color: '#11336A',
    },
    horizontalScroll: {
        flexDirection: 'row',
        marginBottom: 40,
    },
    cardWrapper: {
        marginRight: 15,
    },
    completedCard: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 15,
        width: 130,
        height: 107,
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedCardWrapper: {
        marginRight: 15,
        marginBottom: 15,
    },
    completedText: {
        ...typography.bold,
        fontSize: 16,
        color: '#11336A',
    },
    completedAngText: {
        ...typography.regular,
        fontSize: 14,
        color: '#666666',
    },
});

export default HomeScreen;