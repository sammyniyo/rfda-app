import { View, Text, TextInput, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image } from 'react-native';
import { colors } from '../constants/theme';
import { api } from '../constants/api';
import { errors as msg } from '../lib/messages';
import PressableScale from '../components/PressableScale';
import FadeInView from '../components/FadeInView';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Reset password', msg.forgotPassword.emptyEmail, [{ text: 'OK' }]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(api.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Reset password', data.error || msg.forgotPassword.requestFailed, [{ text: 'Try again' }]);
        return;
      }
      setSuccess(true);
    } catch (err) {
      Alert.alert('Connection issue', msg.forgotPassword.connection, [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <FadeInView delay={0}>
              <Image source={require('../assets/RwandaFDA.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtext}>
                If an account exists with that email, you will receive a password reset link shortly.
              </Text>
              <Text style={styles.subtextSmall}>
                In development, the reset link may appear in the server console.
              </Text>
              <PressableScale style={styles.ctaButton} onPress={() => router.back()}>
                <Text style={styles.ctaButtonText}>Back to sign in</Text>
              </PressableScale>
            </FadeInView>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <FadeInView delay={0}>
            <Image source={require('../assets/RwandaFDA.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Forgot password?</Text>
            <Text style={styles.subtext}>Enter your email and we'll send you a reset link.</Text>
          </FadeInView>

          <FadeInView delay={100}>
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

          <FadeInView delay={150}>
            <PressableScale
              style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaButtonText}>Send reset link</Text>
              )}
            </PressableScale>

            <PressableScale style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back to sign in</Text>
            </PressableScale>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#fff' },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 48,
  },
  logo: {
    width: 140,
    height: 120,
    alignSelf: 'center',
    marginBottom: 32,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  subtext: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  subtextSmall: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 24,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 0,
  },
  inputUnderline: {
    height: 1,
    backgroundColor: '#e4e7ec',
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: colors.text,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  ctaButtonDisabled: { opacity: 0.7 },
  ctaButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
