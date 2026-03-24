import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { api } from '../constants/api';
import { getAuthHeaders, isApiSuccess } from '../lib/api';
import { ensureAndroidAlertChannelAsync } from '../lib/pushNotifications';
import {
  buildMessagingStyleNotificationContent,
  ensureMessagingNotificationCategory,
} from '../lib/messagingStyleNotifications';

// Push stack removed in Expo Go SDK 53+ — avoid native module calls
const isExpoGo = Constants.appOwnership === 'expo';
const NOTIFICATION_POLL_MS = 30000;

function getNotificationsModule() {
  try {
    // eslint-disable-next-line global-require
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function guessLink(item) {
  const text = `${String(item?.type || '').toLowerCase()} ${String(item?.title || '').toLowerCase()} ${String(
    item?.message || ''
  ).toLowerCase()}`;
  if (text.includes('task')) return '/(app)/tasks';
  if (text.includes('application') || text.includes('app')) return '/(app)/applications';
  if (text.includes('profile')) return '/(app)/profile';
  return '/(app)/notifications';
}

function routeFromLink(link) {
  const path = String(link || '').trim();
  if (path.startsWith('/')) return path;
  const lower = path.toLowerCase();
  if (lower.includes('task')) return '/(app)/tasks';
  if (lower.includes('application') || lower.includes('app')) return '/(app)/applications';
  if (lower.includes('profile')) return '/(app)/profile';
  return '/(app)/notifications';
}

export default function PushNotificationsProvider({ children }) {
  const { token } = useAuth();
  const hasRegisteredRef = useRef(false);
  const seenNotificationIdsRef = useRef(new Set());
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (isExpoGo) return;
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  useEffect(() => {
    if (isExpoGo || !token) {
      hasRegisteredRef.current = false;
      return;
    }

    (async () => {
      // eslint-disable-next-line global-require
      const pushLib = require('../lib/pushNotifications');
      const pushToken = await pushLib.registerForPushNotificationsAsync();
      if (pushToken && !hasRegisteredRef.current) {
        hasRegisteredRef.current = true;
        try {
          await fetch(api.registerDevice, {
            method: 'POST',
            headers: getAuthHeaders(() => token),
            body: JSON.stringify({
              token: pushToken,
              platform: Platform.OS,
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
    const Notifications = getNotificationsModule();
    if (!Notifications) return undefined;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data;
      const target = data?.link ? routeFromLink(data.link) : '/(app)/notifications';
      try {
        router.push(target);
      } catch {
        router.push('/(app)/notifications');
      }
    });
    return () => sub.remove();
  }, []);

  const fetchAndNotify = useCallback(async () => {
    if (isExpoGo || !token) return;

    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    await ensureAndroidAlertChannelAsync().catch(() => {});

    const perms = await Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' }));
    let status = perms?.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync().catch(() => ({ status }));
      status = requested?.status ?? status;
    }
    if (status !== 'granted') {
      if (Platform.OS === 'ios') {
        await Notifications.setBadgeCountAsync(0).catch(() => {});
      }
      return;
    }

    const tokenValue = String(token || '');
    const headersBearer = { ...getAuthHeaders(() => token), Authorization: `Bearer ${tokenValue}` };
    const headersRaw = { ...getAuthHeaders(() => token), Authorization: tokenValue };

    let res = await fetch(api.notifications, { headers: headersBearer });
    let payload = await res.json().catch(() => ({}));
    if (!res.ok && (res.status === 401 || res.status === 403)) {
      res = await fetch(api.notifications, { headers: headersRaw });
      payload = await res.json().catch(() => ({}));
    }
    if (!res.ok || !isApiSuccess(payload)) return;

    const items = extractItems(payload);
    const unread = items.filter((n) => !n?.read_at);

    if (Platform.OS === 'ios') {
      await Notifications.setBadgeCountAsync(unread.length).catch(() => {});
    }

    if (!hydratedRef.current) {
      seenNotificationIdsRef.current = new Set(
        unread.map((n) => String(n.id ?? n.notification_id ?? '')).filter(Boolean)
      );
      hydratedRef.current = true;
      return;
    }

    for (const item of unread) {
      const id = String(item?.id ?? item?.notification_id ?? '');
      if (!id || seenNotificationIdsRef.current.has(id)) continue;

      seenNotificationIdsRef.current.add(id);

      const link = item?.link || guessLink(item);
      const content = await buildMessagingStyleNotificationContent(item, link, Notifications);

      await Notifications.scheduleNotificationAsync({
        content,
        trigger: null,
      }).catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    if (isExpoGo) return undefined;

    if (!token) {
      seenNotificationIdsRef.current = new Set();
      hydratedRef.current = false;
      const Notifications = getNotificationsModule();
      if (Notifications && Platform.OS === 'ios') {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
      return undefined;
    }

    fetchAndNotify().catch(() => {});
    const intervalId = setInterval(() => {
      fetchAndNotify().catch(() => {});
    }, NOTIFICATION_POLL_MS);

    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') fetchAndNotify().catch(() => {});
    });

    return () => {
      clearInterval(intervalId);
      appSub.remove();
    };
  }, [token, fetchAndNotify]);

  return children;
}
