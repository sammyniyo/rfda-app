import { View, Image, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '../context/ThemeContext';
import { colors, spacing } from '../constants/theme';

/** Minimal full-screen loader — logo + small spinner + one short line (sessions, dashboard, sign-in). */
export default function AuthLoadingScreen({ message = 'Loading…' }) {
  const { isDark } = useThemeMode();
  const pageBg = isDark ? '#0b1220' : '#f8fafc';
  const messageColor = isDark ? '#94a3b8' : '#64748b';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <View
          style={[
            styles.logoShell,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 94, 71, 0.1)',
            },
          ]}
        >
          <Image source={require('../assets/RwandaFDA.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <ActivityIndicator size="small" color={colors.fdaGreen} style={styles.spinner} />
        <Text style={[styles.message, { color: messageColor }]} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoShell: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logo: { width: 56, height: 46 },
  spinner: { marginBottom: spacing.sm },
  message: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});
