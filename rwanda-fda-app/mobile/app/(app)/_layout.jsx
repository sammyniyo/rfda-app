import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../constants/theme';
import { useThemeMode } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '../../hooks/useQuery';
import { getAuthHeaders, isApiSuccess } from '../../lib/api';
import { api } from '../../constants/api';
import { useEffect, useMemo, useRef } from 'react';
import AuthLoadingScreen from '../../components/AuthLoadingScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchMonitoringPerformance, extractPerformanceTasks } from '../../lib/monitoringPerformance';
import { getMonitoringStaffId } from '../../lib/staffSession';

/** Tab bar palette — dark bar + light bar with gradient via tabBarBackground */
const TAB_BAR = {
  dark: {
    gradient: ['#1c1c1e', '#000000'],
    barBorder: 'rgba(255,255,255,0.1)',
    active: '#ffffff',
    inactive: '#8d9599',
    indicator: '#ffffff',
    badgeBg: '#25d366',
  },
  light: {
    gradient: ['#ffffff', '#f2f4f5'],
    barBorder: 'rgba(0,0,0,0.07)',
    active: '#0f5e47',
    inactive: '#6b7280',
    indicator: '#0f5e47',
    badgeBg: colors.fdaGreen,
  },
};

/** Line-art icons only (outline weight reads like WhatsApp iOS). */
const TAB_ICONS = {
  index: 'home-outline',
  tasks: 'checkbox-outline',
  applications: 'document-text-outline',
  notifications: 'notifications-outline',
  profile: 'person-outline',
};

const TAB_LABELS = {
  index: 'Home',
  tasks: 'Tasks',
  applications: 'Apps',
  notifications: 'Alerts',
  profile: 'You',
};

function countOpenTasksFromPayload(list) {
  if (!Array.isArray(list)) return 0;
  return list.filter((t) => {
    if (t.is_completed) return false;
    const s = String(t.status ?? t.task_status ?? '').toLowerCase();
    return s !== 'completed' && s !== 'review';
  }).length;
}

function TabBarIcon({ focused, routeName, isDark, badgeCount = 0 }) {
  const palette = isDark ? TAB_BAR.dark : TAB_BAR.light;
  const iconColor = focused ? palette.active : palette.inactive;
  const name = TAB_ICONS[routeName] || 'ellipse-outline';
  const showBadge = badgeCount > 0;
  const badgeLabel = badgeCount > 99 ? '99+' : String(badgeCount);
  const badgeBorder = isDark ? '#000000' : '#ffffff';

  return (
    <View style={styles.iconColumn}>
      <View style={styles.iconSlot}>
        <View style={styles.iconWithBadge}>
          <Ionicons name={name} size={24} color={iconColor} />
          {showBadge ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: palette.badgeBg,
                  borderColor: badgeBorder,
                  minWidth: badgeLabel.length > 2 ? 26 : badgeLabel.length > 1 ? 22 : 18,
                  paddingHorizontal: badgeLabel.length > 2 ? 6 : 5,
                },
              ]}
            >
              <Text style={styles.badgeText} allowFontScaling={false}>
                {badgeLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.indicatorTrack}>
        {focused ? (
          <View style={[styles.indicator, { backgroundColor: palette.indicator }]} />
        ) : (
          <View style={styles.indicatorPlaceholder} />
        )}
      </View>
    </View>
  );
}

/**
 * Tabs + notification polling — only mounted when authenticated.
 * Must stay separate from the auth gate so hook order never changes on logout (avoids crashes + redirect loops).
 */
function AuthenticatedTabs({ isDark, resolvedTheme, token }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const tasksTabQuery = useQuery(
    async () => {
      if (!token) return [];
      const staffId = getMonitoringStaffId(user);
      const { payload } = await fetchMonitoringPerformance({
        staffId,
        token,
        getToken: () => token,
      });
      return extractPerformanceTasks(payload);
    },
    [token, user?.staff_id],
    { cacheKey: token ? `tab_bar_tasks_${token}` : undefined }
  );

  const openTaskCount = useMemo(
    () => countOpenTasksFromPayload(tasksTabQuery.data),
    [tasksTabQuery.data]
  );

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
  const palette = isDark ? TAB_BAR.dark : TAB_BAR.light;

  const TabBarBg = () => (
    <LinearGradient
      colors={[...palette.gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );

  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      notificationsQuery.refetch().catch(() => {});
      tasksTabQuery.refetch().catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [token]);

  return (
    <Tabs
      key={resolvedTheme}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.active,
        tabBarInactiveTintColor: palette.inactive,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: true,
        tabBarBackground: TabBarBg,
        tabBarItemStyle: {
          paddingTop: 8,
          paddingBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.barBorder,
          elevation: 0,
          shadowOpacity: 0,
          minHeight: 56 + Math.max(insets.bottom, 8),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarIcon: ({ focused }) => {
          const badgeCount =
            route.name === 'index'
              ? openTaskCount
              : route.name === 'notifications'
                ? unreadCount
                : 0;
          return (
            <TabBarIcon focused={focused} routeName={route.name} isDark={isDark} badgeCount={badgeCount} />
          );
        },
        tabBarLabel: ({ focused }) => (
          <View style={styles.tabLabelWrap}>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.tabLabelText,
                {
                  fontWeight: focused ? '700' : '500',
                  color: focused ? palette.active : palette.inactive,
                },
              ]}
            >
              {TAB_LABELS[route.name] || route.name}
            </Text>
          </View>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="tasks" options={{ title: 'My Tasks' }} />
      <Tabs.Screen name="task" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="applications" options={{ title: 'Applications' }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Tabs.Screen name="profile" options={{ title: 'My Profile' }} />
    </Tabs>
  );
}

export default function AppLayout() {
  const { isDark, resolvedTheme } = useThemeMode();
  const { token, loading } = useAuth();
  const router = useRouter();
  /** `useRouter()` identity is often unstable; never put `router` in effect deps or replace('/') loops forever. */
  const hasSentToRootRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (token) {
      hasSentToRootRef.current = false;
      return;
    }
    if (hasSentToRootRef.current) return;
    hasSentToRootRef.current = true;
    router.replace('/');
  }, [loading, token]);

  if (loading) {
    return <AuthLoadingScreen message="Restoring your session…" />;
  }
  if (!token) {
    return <AuthLoadingScreen message="Signing out…" />;
  }

  return <AuthenticatedTabs isDark={isDark} resolvedTheme={resolvedTheme} token={token} />;
}

const styles = StyleSheet.create({
  tabLabelWrap: {
    minHeight: 14,
    marginTop: 4,
    marginBottom: 2,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: 72,
  },
  tabLabelText: {
    fontSize: 10.5,
    letterSpacing: -0.15,
    textAlign: 'center',
  },
  iconColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 64,
  },
  iconSlot: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWithBadge: {
    width: 36,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
      },
      android: { elevation: 3 },
    }),
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  indicatorTrack: {
    height: 3,
    marginTop: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  indicator: {
    width: 28,
    height: 3,
    borderRadius: 2,
  },
  indicatorPlaceholder: {
    height: 3,
    width: 28,
  },
});
