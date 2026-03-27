import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { PreviewWebNoticeProvider } from '../context/PreviewWebNoticeContext';
import { ThemeProvider, useThemeMode } from '../context/ThemeContext';
import { LanguageProvider } from '../context/LanguageContext';
import PushNotificationsProvider from '../components/PushNotificationsProvider';

/** Stable refs — inline `{ headerShown: false }` creates a new object every render and can trigger
 *  React Navigation / expo-router layout effects + useSyncState in an infinite update loop. */
const ROOT_STACK_SCREEN_OPTIONS = { headerShown: false };

function RootNavigator() {
  return (
    <Stack screenOptions={ROOT_STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="(app)"
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: "slide_from_right",
        }}
      />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <LanguageProvider>
          <PreviewWebNoticeProvider>
            <AuthProvider>
              <PushNotificationsProvider>
                <ThemeAwareStatus />
                <RootNavigator />
              </PushNotificationsProvider>
            </AuthProvider>
          </PreviewWebNoticeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function ThemeAwareStatus() {
  const { isDark } = useThemeMode();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
