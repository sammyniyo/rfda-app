import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { AuthProvider } from '../context/AuthContext';
import { PreviewWebNoticeProvider } from '../context/PreviewWebNoticeContext';
import { ThemeProvider, useThemeMode } from '../context/ThemeContext';

const PushNotificationsProvider =
  Constants.appOwnership === 'expo'
    ? ({ children }) => children
    : require('../components/PushNotificationsProvider').default;

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <PreviewWebNoticeProvider>
          <AuthProvider>
            <PushNotificationsProvider>
              <ThemeAwareStatus />
              <RootNavigator />
            </PushNotificationsProvider>
          </AuthProvider>
        </PreviewWebNoticeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function ThemeAwareStatus() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
