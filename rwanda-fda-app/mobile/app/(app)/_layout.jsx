import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../constants/theme';

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

export default function AppLayout() {
  const { token } = useAuth();
  if (!token) return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.fdaGreen,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 60,
          paddingTop: 4,
          paddingBottom: 6,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(15,23,42,0.08)',
          backgroundColor: colors.card,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const [outline, filled] = TAB_ICONS[route.name] || ['ellipse-outline', 'ellipse'];
          const icon = (
            <Ionicons
              name={focused ? filled : outline}
              size={size ?? 22}
              color={focused ? colors.fdaGreen : color}
            />
          );

          if (route.name === 'notifications') {
            const dummyBadge = 5;
            return (
              <View style={{ alignItems: 'center' }}>
                {icon}
                <View
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: colors.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{dummyBadge}</Text>
                </View>
              </View>
            );
          }

          return icon;
        },
        tabBarLabel: ({ focused, color }) => (
          <Text
            style={{
              fontSize: 10,
              fontWeight: focused ? '700' : '500',
              marginTop: 1,
              color: focused ? colors.fdaGreen : colors.textMuted,
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
      <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Tabs.Screen name="profile" options={{ title: 'My Profile' }} />
    </Tabs>
  );
}
