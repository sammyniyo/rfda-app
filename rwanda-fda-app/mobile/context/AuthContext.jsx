import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../constants/api';
import { NOTIFICATION_DISMISSED_STORAGE_KEY } from '../lib/notificationsFeed';

/** Best-effort: tell PHP to expire the row in `tbl_api_tokens` (Bearer + JSON body per logout_api.php). */
async function invalidateTokenOnServer(tokenValue) {
  const t = String(tokenValue || '').trim();
  if (!t) return;
  const body = JSON.stringify({ token: t });
  const post = (headers) =>
    fetch(api.logout, { method: 'POST', headers, body }).catch(() => null);
  try {
    let res = await post({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${t}`,
    });
    if (res && !res.ok && (res.status === 401 || res.status === 403)) {
      await post({
        'Content-Type': 'application/json',
        Authorization: t,
      });
    }
  } catch {
    // Offline or network error — local logout still proceeds.
  }
}

const AuthContext = createContext(null);

const TOKEN_KEY = 'rwanda_fda_token';
const USER_KEY = 'rwanda_fda_user';
const BIOMETRIC_EMAIL_KEY = 'rwanda_fda_biometric_email';

// Prevent a race on logout where the provider remounts and re-hydrates the old
// token from SecureStore before deletion fully propagates.
let SKIP_NEXT_RESTORE = false;

const SAFE_AUTH = {
  token: null,
  user: null,
  loading: false,
  setToken: async () => {},
  updateUser: async () => {},
  logout: async () => {},
  enableBiometricEmail: async () => {},
  getStoredToken: async () => null,
  getStoredUser: async () => null,
  getBiometricEmail: async () => null,
};

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = React.useRef(token);
  tokenRef.current = token;

  const setToken = useCallback(async (newToken, newUser) => {
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
  }, []);

  /** Merge fields into the current user (e.g. `data.staff` from performance_api) and persist. */
  const updateUser = useCallback(async (patch) => {
    if (!patch || typeof patch !== 'object') return;
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch };
      queueMicrotask(() => {
        if (tokenRef.current) {
          SecureStore.setItemAsync(USER_KEY, JSON.stringify(next)).catch(() => {});
        }
      });
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    const sessionToken = tokenRef.current && String(tokenRef.current).trim();
    SKIP_NEXT_RESTORE = true;
    try {
      await invalidateTokenOnServer(sessionToken);
    } catch {
      /* network / native — still clear local session */
    }
    // Important: delete persisted token soon after server invalidation attempt.
    // Otherwise expo-router redirects can remount AuthProvider and temporarily restore
    // the old token from SecureStore, causing redirect/update loops.
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY).catch(() => {});
    await AsyncStorage.removeItem(NOTIFICATION_DISMISSED_STORAGE_KEY).catch(() => {});
    setTokenState(null);
    setUser(null);
    setLoading(false);
  }, []);

  const enableBiometricEmail = useCallback(async (email) => {
    if (email) await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
  }, []);

  const getStoredToken = useCallback(async () => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  }, []);

  const getStoredUser = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const getBiometricEmail = useCallback(async () => {
    try {
      return await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (SKIP_NEXT_RESTORE) {
        SKIP_NEXT_RESTORE = false;
        setLoading(false);
        return;
      }
      const t = await getStoredToken();
      const u = await getStoredUser();
      if (t && u) {
        setTokenState(t);
        setUser(u);
      }
      setLoading(false);
    })();
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      setToken,
      updateUser,
      logout,
      enableBiometricEmail,
      getStoredToken,
      getStoredUser,
      getBiometricEmail,
    }),
    [
      token,
      user,
      loading,
      setToken,
      updateUser,
      logout,
      enableBiometricEmail,
      getStoredToken,
      getStoredUser,
      getBiometricEmail,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Prevent hard-crash if a route renders outside AuthProvider during redirects.
    // This can happen momentarily after logout when expo-router remounts layouts.
    return SAFE_AUTH;
  }
  return ctx;
}
