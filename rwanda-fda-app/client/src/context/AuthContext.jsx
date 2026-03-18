import { createContext, useContext, useState, useEffect } from "react";

const TOKEN_KEY = "rwanda_fda_token";
const USER_KEY = "rwanda_fda_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Uncomment below to enable auto-login with localStorage persistence
    // const t = localStorage.getItem(TOKEN_KEY);
    // const u = localStorage.getItem(USER_KEY);
    // if (t && u) {
    //   setTokenState(t);
    //   try {
    //     setUser(JSON.parse(u));
    //   } catch {}
    // }
    setLoading(false);
  }, []);

  const setToken = (newToken, newUser) => {
    setTokenState(newToken);
    setUser(newUser || null);
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
      if (newUser) localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  };

  const logout = () => setToken(null, null);

  return (
    <AuthContext.Provider value={{ token, user, setToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
