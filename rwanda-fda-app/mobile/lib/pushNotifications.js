import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

// Skip in Expo Go (push removed in SDK 53) to avoid HostFunction errors
const isExpoGo = Constants.appOwnership === 'expo';

/** Must match channelId in PushNotificationsProvider when scheduling local alerts */
export const ANDROID_ALERT_CHANNEL_ID = 'rwanda-fda-alerts';

export async function ensureAndroidAlertChannelAsync() {
  if (Platform.OS !== 'android') return;
  try {
  await Notifications.setNotificationChannelAsync(ANDROID_ALERT_CHANNEL_ID, {
    name: 'Rwanda FDA alerts',
    description: 'Task and application updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0f5e47',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
  } catch {
    /* Expo Go / hosts without full channel API */
  }
}

export async function registerForPushNotificationsAsync() {
  if (isExpoGo || !Device.isDevice) {
    return null;
  }

  await ensureAndroidAlertChannelAsync();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return tokenResult?.data ?? null;
  } catch {
    return null;
  }
}
