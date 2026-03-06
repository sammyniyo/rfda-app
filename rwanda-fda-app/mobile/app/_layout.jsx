import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { AuthProvider } from '../context/AuthContext';

// Avoid loading expo-notifications in Expo Go (HostFunction crash)
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
    <AuthProvider>
      <PushNotificationsProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </PushNotificationsProvider>
    </AuthProvider>
  );
}
