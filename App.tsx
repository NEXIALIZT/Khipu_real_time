import React from 'react';
import { View, StyleSheet, SafeAreaView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from './src/store/useAppStore';
import { HomeScreen } from './src/screens/HomeScreen';
import { HostScreen } from './src/screens/HostScreen';
import { AssistantScreen } from './src/screens/AssistantScreen';
import { CallScreen } from './src/screens/CallScreen';

export default function App() {
  const currentScreen = useAppStore(state => state.currentScreen);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'Home':
        return <HomeScreen />;
      case 'Host':
        return <HostScreen />;
      case 'Assistant':
        return <AssistantScreen />;
      case 'Call':
        return <CallScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        {renderScreen()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  safeArea: {
    flex: 1,
    // En Web, no necesitamos el padding extra del notch de iOS/Android
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
});
