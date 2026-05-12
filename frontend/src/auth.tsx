// AsyncStorage-backed auth context with email/password + Google flows.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "leakstop_token";

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  auth_provider: string;
  subscription?: { plan: string; active: boolean; expires_at?: string } | null;
};

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  register: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleSession: (session_id: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return await SecureStore.getItemAsync(key);
}
async function storageSet(key: string, val: string) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, val);
    return;
  }
  await SecureStore.setItemAsync(key, val);
}
async function storageDel(key: string) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function jsonFetch(path: string, init?: RequestInit, token?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      detail = JSON.parse(text).detail ?? text;
    } catch {}
    throw new Error(detail || `request failed: ${res.status}`);
  }
  return res.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await storageGet(TOKEN_KEY);
    if (!t) {
      setUser(null);
      setToken(null);
      return;
    }
    try {
      const me = await jsonFetch("/auth/me", {}, t);
      setUser(me);
      setToken(t);
    } catch {
      await storageDel(TOKEN_KEY);
      setUser(null);
      setToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const register = async (email: string, password: string, name: string) => {
    const r = await jsonFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    await storageSet(TOKEN_KEY, r.token);
    setToken(r.token);
    setUser(r.user);
  };

  const login = async (email: string, password: string) => {
    const r = await jsonFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await storageSet(TOKEN_KEY, r.token);
    setToken(r.token);
    setUser(r.user);
  };

  const googleSession = async (session_id: string) => {
    const r = await jsonFetch("/auth/google/session", {
      method: "POST",
      body: JSON.stringify({ session_id }),
    });
    await storageSet(TOKEN_KEY, r.token);
    setToken(r.token);
    setUser(r.user);
  };

  const logout = async () => {
    try {
      await jsonFetch("/auth/logout", { method: "POST" }, token);
    } catch {}
    await storageDel(TOKEN_KEY);
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, register, login, googleSession, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export async function authedFetch(path: string, init: RequestInit, token: string | null) {
  return jsonFetch(path, init, token);
}
