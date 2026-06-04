import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { COLORS } from '@/constants/theme';
import { hasSeenOnboarding } from '@/services/storage';

export default function RootLayout() {
  const [ready,   setReady]   = useState(false);
  const [showOB,  setShowOB]  = useState(false);

  useEffect(() => {
    hasSeenOnboarding().then(seen => {
      setShowOB(!seen);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.coralD} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        {showOB && (
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        )}
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="lesson"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen
          name="reverse"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
