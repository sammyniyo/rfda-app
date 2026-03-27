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
const SECURESTORE_SAFE_LIMIT = 1800;

function compactReportsTo(v) {
  if (!v || typeof v !== 'object') return null;
  return {
    staff_id: v.staff_id ?? v.id ?? null,
    name: v.name ?? null,
    email: v.email ?? null,
    department: v.department ?? null,
    role: v.role ?? null,
    staff_group: v.staff_group ?? v.group ?? null,
  };
}

/**
 * SecureStore values should stay very small (<~2KB on many devices).
 * Persist only fields needed to rehydrate a session quickly; avoid large lists.
 */
function compactUserForStorage(user) {
  if (!user || typeof user !== 'object') return null;
  const compact = {
    id: user.id ?? null,
    user_id: user.user_id ?? null,
    staff_id: user.staff_id ?? null,
    name: user.name ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role ?? null,
    group: user.group ?? null,
    staff_group: user.staff_group ?? null,
    position: user.position ?? user.staff_position ?? null,
    department: user.department ?? null,
    dutyStation: user.dutyStation ?? null,
    station: user.station ?? null,
    orgUnitName: user.orgUnitName ?? null,
    parentOrgUnitName: user.parentOrgUnitName ?? null,
    contractType: user.contractType ?? null,
    degree: user.degree ?? null,
    qualifications: user.qualifications ?? null,
    hireDate: user.hireDate ?? null,
    is_non_statute: user.is_non_statute ?? null,
    reports_to: compactReportsTo(user.reports_to),
  };
  return compact;
}

async function persistUserSafely(user) {
  const compact = compactUserForStorage(user);
  if (!compact) return;
  const raw = JSON.stringify(compact);
  if (raw.length > SECURESTORE_SAFE_LIMIT) {
    // Ultra-defensive fallback if custom fields still overflow.
    const minimal = JSON.stringify({
      staff_id: compact.staff_id,
      name: compact.name,
      email: compact.email,
      role: compact.role,
    });
    await SecureStore.setItemAsync(USER_KEY, minimal);
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, raw);
}

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
        await persistUserSafely(newUser);
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
          persistUserSafely(next).catch(() => {});
        }
      });
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    const sessionToken = tokenRef.current && String(tokenRef.current).trim();
    SKIP_NEXT_RESTORE = true;
    // Clear local session first to avoid auth/routing update loops.
    setTokenState(null);
    setUser(null);
    setLoading(false);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(USER_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY).catch(() => {});
    await AsyncStorage.removeItem(NOTIFICATION_DISMISSED_STORAGE_KEY).catch(() => {});
    // Best-effort server invalidation after local logout.
    if (sessionToken) {
      invalidateTokenOnServer(sessionToken).catch(() => {});
    }
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
