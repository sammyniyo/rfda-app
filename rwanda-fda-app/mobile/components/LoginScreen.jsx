import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { colors } from '../constants/theme';
import { api } from '../constants/api';
import { errors as msg } from '../lib/messages';
import PressableScale from './PressableScale';
import FadeInView from './FadeInView';

export default function LoginScreen() {
  const { setToken, enableBiometricEmail, getStoredToken, getBiometricEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [savedEmail, setSavedEmail] = useState(null);

  React.useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
      const emailForBio = await getBiometricEmail();
      if (emailForBio) setSavedEmail(emailForBio);
    })();
  }, []);

  const signInWithCredentials = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Sign in', msg.login.emptyFields, [{ text: 'OK' }]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(api.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: email.trim().toLowerCase(),
          user_passcode: password,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload.error || payload.success === false) {
        Alert.alert('Sign in', payload.error || payload.message || msg.login.invalidCredentials, [
          { text: 'Try again' },
        ]);
        return;
      }

      const data = payload.data || payload;
      const normalizedEmail = email.trim().toLowerCase();

      // Build a rich user object from the Monitoring Tool response
      const baseUser = {
        id: data.user?.user_id ?? data.staff?.staff_id,
        email: data.user?.user_email || data.staff?.staff_email || normalizedEmail,
        access: data.user?.user_access ?? null,
        roleId: data.user?.role_id ?? null,
      };

      const staffProfile = data.staff
        ? {
            name: data.staff.staff_names || normalizedEmail,
            phone: data.staff.staff_phone || null,
            gender: data.staff.staff_gender || null,
            group: data.staff.staff_group || null,
            dutyStation: data.staff.staff_duty_station || null,
            employmentType: data.staff.staff_employment_type || null,
            hireDate: data.staff.staff_hire_date || null,
            degree: data.staff.staff_degree || null,
            qualifications: data.staff.staff_qualifications || null,
            supervisorId: data.staff.supervisor_id ?? null,
          }
        : {};

      const user = {
        ...baseUser,
        ...staffProfile,
      };

      await setToken(data.token || payload.token || 'php-session', user);
      await enableBiometricEmail(normalizedEmail);
      router.replace('/(app)');
    } catch (err) {
      Alert.alert('Connection issue', msg.login.connection, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const signInWithBiometric = async () => {
    if (!savedEmail) return;

    const token = await getStoredToken();
    if (!token) {
      Alert.alert('Biometric sign-in', msg.biometric.signInFirst, [{ text: 'OK' }]);
      return;
    }

    try {
      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Sign in to Rwanda FDA',
        cancelLabel: 'Cancel',
      });
      if (success) router.replace('/(app)');
    } catch {
      Alert.alert('Biometric sign-in', msg.biometric.failed, [{ text: 'Use password' }]);
    }
  };

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <FadeInView delay={0} translateY={16}>
              <Image source={require('../assets/RwandaFDA.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.tagline}>Staff Portal</Text>
              <Text style={styles.subtitle}>Sign in to manage tasks, track applications, and stay updated.</Text>
            </FadeInView>

            <FadeInView delay={160} translateY={12}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textSubtle}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
              <View style={styles.inputUnderline} />
            </FadeInView>

            <FadeInView delay={200} translateY={12}>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor={colors.textSubtle}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={12}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textSubtle}
                  />
                </Pressable>
              </View>
              <View style={styles.inputUnderline} />
            </FadeInView>

            <FadeInView delay={240} translateY={12}>
              <PressableScale style={styles.forgotWrap} onPress={() => router.push('/forgot-password')}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </PressableScale>

              <PressableScale
                style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
                onPress={signInWithCredentials}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaButtonText}>Sign In</Text>
                )}
              </PressableScale>

              {biometricAvailable && savedEmail ? (
                <PressableScale
                  style={styles.biometricButton}
                  onPress={signInWithBiometric}
                  disabled={loading}
                >
                  <Text style={styles.biometricText}>
                    {Platform.OS === 'ios' ? 'Sign in with Face ID' : 'Sign in with Fingerprint'}
                  </Text>
                </PressableScale>
              ) : null}
            </FadeInView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 48,
  },
  logo: {
    width: 140,
    height: 120,
    alignSelf: 'center',
    marginBottom: 16,
  },
  tagline: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 8,
  },
  eyeButton: {
    padding: 8,
  },
  inputUnderline: {
    height: 1,
    backgroundColor: '#e4e7ec',
    marginBottom: 24,
  },
  forgotWrap: { alignSelf: 'flex-start', marginBottom: 24 },
  forgotText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  ctaButton: {
    backgroundColor: colors.text,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  ctaButtonDisabled: { opacity: 0.7 },
  ctaButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  biometricButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  biometricText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
