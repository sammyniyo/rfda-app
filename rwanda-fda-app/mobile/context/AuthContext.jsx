import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const AuthContext = createContext(null);

const TOKEN_KEY = 'rwanda_fda_token';
const USER_KEY = 'rwanda_fda_user';
const BIOMETRIC_EMAIL_KEY = 'rwanda_fda_biometric_email';

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setToken = async (newToken, newUser) => {
    setTokenState(newToken);
    setUser(newUser || null);
    if (newToken) {
      await SecureStore.setItemAsync(TOKEN_KEY, newToken);
      if (newUser) {
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
      }
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
    }
  };

  const logout = async () => {
    setTokenState(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
  };

  const enableBiometricEmail = async (email) => {
    if (email) await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
  };

  const getStoredToken = async () => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  };

  const getStoredUser = async () => {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const getBiometricEmail = async () => {
    try {
      return await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      const t = await getStoredToken();
      const u = await getStoredUser();
      if (t && u) {
        setTokenState(t);
        setUser(u);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        setToken,
        logout,
        enableBiometricEmail,
        getStoredToken,
        getStoredUser,
        getBiometricEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
