import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { api, setAuthToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = "pace_session_token";

type User = {
  user_id: string;
  email: string;
  name?: string;
  picture?: string | null;
  onboarding_completed: boolean;
  profile?: any;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processed = useRef<Set<string>>(new Set());
  const capturedUrl = useRef<string | null>(null);

  const persistToken = useCallback(async (token: string) => {
    setAuthToken(token);
    await storage.secureSet(TOKEN_KEY, token);
  }, []);

  const applyAuth = useCallback(async (resp: any) => {
    await persistToken(resp.session_token);
    setUser(resp.user);
  }, [persistToken]);

  const exchangeSession = useCallback(async (sessionId: string) => {
    if (processed.current.has(sessionId)) return;
    processed.current.add(sessionId);
    const resp = await api.googleSession(sessionId);
    await applyAuth(resp);
  }, [applyAuth]);

  const bootstrap = useCallback(async () => {
    // Web: process session_id from URL first
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const m = (hash + search).match(/session_id=([^&#]+)/);
      if (m) {
        try {
          await exchangeSession(decodeURIComponent(m[1]));
          window.history.replaceState(window.history.state, "", window.location.pathname);
          setLoading(false);
          return;
        } catch {
          /* fall through */
        }
      }
    }
    const token = await storage.secureGet<string>(TOKEN_KEY, "");
    if (token) {
      setAuthToken(token);
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        setAuthToken(null);
        await storage.secureRemove(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, [exchangeSession]);

  useEffect(() => {
    bootstrap();
    const sub = Linking.addEventListener("url", ({ url }) => {
      capturedUrl.current = url;
      const m = url.match(/[?#&]session_id=([^&#]+)/);
      if (m) exchangeSession(decodeURIComponent(m[1])).catch(() => {});
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await api.login(email, password);
    await applyAuth(resp);
  }, [applyAuth]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const resp = await api.register(email, password, name);
    await applyAuth(resp);
  }, [applyAuth]);

  const loginWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    capturedUrl.current = null;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let url: string | null = result.type === "success" ? result.url : null;
    if (!url) url = capturedUrl.current;
    if (!url) url = await Linking.getInitialURL();
    if (!url) return;
    const m = url.match(/[?#&]session_id=([^&#]+)/);
    if (!m) return;
    await exchangeSession(decodeURIComponent(m[1]));
  }, [exchangeSession]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
