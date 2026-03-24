import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Text, View } from 'react-native';
import { colors } from '../../constants/theme';
import { useThemeMode } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '../../hooks/useQuery';
import { getAuthHeaders, isApiSuccess } from '../../lib/api';
import { api } from '../../constants/api';
import { useEffect, useRef } from 'react';

const TAB_ICONS = {
  index: ['grid-outline', 'grid'],
  tasks: ['checkbox-outline', 'checkbox'],
  applications: ['document-text-outline', 'document-text'],
  notifications: ['notifications-outline', 'notifications'],
  profile: ['person-outline', 'person'],
};

const TAB_LABELS = {
  index: 'Home',
  tasks: 'Tasks',
  applications: 'Apps',
  notifications: 'Alerts',
  profile: 'You',
};

function AnimatedTabIcon({ focused, color, size, routeName, isDark }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 90,
    }).start();
  }, [focused, progress]);

  const [outline, filled] = TAB_ICONS[routeName] || ['ellipse-outline', 'ellipse'];
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const lift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -2],
  });
  const lineScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={{ width: 52, alignItems: 'center', justifyContent: 'center', paddingTop: 6 }}>
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          width: 28,
          height: 3,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          backgroundColor: colors.fdaGreen,
          opacity: progress,
          transform: [{ scaleX: lineScale }],
        }}
      />
      <Animated.View style={{ transform: [{ translateY: lift }, { scale }] }}>
        <Ionicons
          name={focused ? filled : outline}
          size={size ?? 22}
          color={focused ? colors.fdaGreen : color}
        />
      </Animated.View>
      {!focused && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            width: 28,
            height: 3,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
            backgroundColor: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.08)',
          }}
        />
      )}
    </View>
  );
}

export default function AppLayout() {
  const { isDark, resolvedTheme } = useThemeMode();
  const { token, loading } = useAuth();

  if (loading) return null;
  if (!token) return <Redirect href="/" />;

  const notificationsQuery = useQuery(
    async () => {
      if (!token) return [];
      const tokenValue = String(token || '');
      const headersBearer = { ...getAuthHeaders(() => token), Authorization: `Bearer ${tokenValue}` };
      const headersRaw = { ...getAuthHeaders(() => token), Authorization: tokenValue };
      let res = await fetch(api.notifications, { headers: headersBearer });
      let payload = await res.json().catch(() => ({}));
      if (!res.ok && (res.status === 401 || res.status === 403)) {
        res = await fetch(api.notifications, { headers: headersRaw });
        payload = await res.json().catch(() => ({}));
      }
      if (!res.ok || !isApiSuccess(payload)) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data?.items)) return payload.data.items;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    },
    [token],
    { cacheKey: token ? `tab_notifications_${token}` : undefined }
  );
  const notifItems = Array.isArray(notificationsQuery.data) ? notificationsQuery.data : [];
  const unreadCount = notifItems.filter((n) => !n?.read_at).length;

  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      notificationsQuery.refetch().catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <Tabs
      key={resolvedTheme}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.fdaGreen,
        tabBarInactiveTintColor: isDark ? '#94a3b8' : colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 60,
          paddingTop: 4,
          paddingBottom: 6,
          borderTopWidth: 0.5,
          borderTopColor: isDark ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.08)',
          backgroundColor: isDark ? '#0f172a' : colors.card,
        },
        tabBarIcon: ({ focused, color, size }) => (
          <AnimatedTabIcon
            focused={focused}
            color={color}
            size={size}
            routeName={route.name}
            isDark={isDark}
          />
        ),
        tabBarLabel: ({ focused, color }) => (
          <Text
            style={{
              fontSize: 10,
              fontWeight: focused ? '700' : '500',
              marginTop: 1,
              color: focused ? colors.fdaGreen : isDark ? '#94a3b8' : colors.textMuted,
            }}
          >
            {TAB_LABELS[route.name] || route.name}
          </Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarLabel: 'Home' }} />
      <Tabs.Screen name="tasks" options={{ title: 'My Tasks' }} />
      {/* Hide the task detail stack from the tab bar but keep it routable */}
      <Tabs.Screen name="task" options={{ href: null }} />
      {/* Hidden settings screen, accessible from profile or other links */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="applications" options={{ title: 'Applications' }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            color: '#fff',
            fontSize: 10,
            minWidth: 16,
            height: 16,
            lineHeight: 14,
          },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'My Profile' }} />
    </Tabs>
  );
}
