import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../components/LoginScreen';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return <AuthLoadingScreen message="Preparing sign-in…" />;
  }
  if (token) return <Redirect href="/(app)" />;
  return <LoginScreen />;
}
