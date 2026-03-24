import { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from '../context/ThemeContext';
import { colors, spacing } from '../constants/theme';

/**
 * Full-screen loading — logo and text stay sharp (no scale transform on text).
 * Pulse only the spinner so nothing looks blurry on device.
 */
export default function AuthLoadingScreen({ message = 'Loading…' }) {
  const { isDark } = useThemeMode();
  const spinOpacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(spinOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(spinOpacity, { toValue: 0.55, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [spinOpacity]);

  const pageBg = isDark ? '#0b1220' : '#eceff1';
  const brandColor = colors.fdaGreen;
  const taglineColor = isDark ? '#a8a29e' : '#78716c';
  const messageColor = isDark ? '#94a3b8' : '#57534e';

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

        <Text style={[styles.brand, { color: isDark ? '#f8fafc' : brandColor }]} allowFontScaling={false}>
          RWANDA FDA
        </Text>
        <Text style={[styles.tagline, { color: taglineColor }]} allowFontScaling={false}>
          Rwanda Food and Drugs Authority
        </Text>

        <Animated.View style={[styles.spinnerWrap, { opacity: spinOpacity }]}>
          <ActivityIndicator size="large" color={brandColor} />
        </Animated.View>

        <Text style={[styles.message, { color: messageColor }]} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoShell: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
      },
      android: { elevation: 4 },
    }),
  },
  logo: {
    width: 96,
    height: 80,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.md,
    maxWidth: 320,
  },
  spinnerWrap: {
    marginTop: 28,
    marginBottom: 16,
    height: 36,
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
