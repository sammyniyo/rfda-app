import { View, Image } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../components/LoginScreen';

export default function Index() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <Image source={require('../assets/RwandaFDA.png')} style={{ width: 120, height: 100 }} resizeMode="contain" />
      </View>
    );
  }
  if (token) return <Redirect href="/(app)" />;
  return <LoginScreen />;
}
