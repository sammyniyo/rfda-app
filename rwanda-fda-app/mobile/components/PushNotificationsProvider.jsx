import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { api } from '../constants/api';
import { getAuthHeaders } from '../lib/api';

// Push notifications were removed from Expo Go in SDK 53; skip to avoid HostFunction errors
const isExpoGo = Constants.appOwnership === 'expo';

export default function PushNotificationsProvider({ children }) {
  const { token } = useAuth();
  const hasRegisteredRef = useRef(false);

  useEffect(() => {
    if (isExpoGo || !token) {
      hasRegisteredRef.current = false;
      return;
    }

    (async () => {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken && !hasRegisteredRef.current) {
        hasRegisteredRef.current = true;
        try {
          await fetch(api.registerDevice, {
            method: 'POST',
            headers: getAuthHeaders(() => token),
            body: JSON.stringify({
              token: pushToken,
              platform: require('react-native').Platform.OS,
            }),
          });
        } catch {
          hasRegisteredRef.current = false;
        }
      }
    })();
  }, [token]);

  useEffect(() => {
    if (isExpoGo) return undefined;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.link) {
        const path = String(data.link).toLowerCase();
        if (path.includes('task')) router.push('/(app)/tasks');
        else if (path.includes('application') || path.includes('app')) router.push('/(app)/applications');
        else if (path.includes('profile')) router.push('/(app)/profile');
        else router.push('/(app)');
      } else {
        router.push('/(app)/notifications');
      }
    });
    return () => sub.remove();
  }, []);

  return children;
}
