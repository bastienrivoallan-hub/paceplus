import React, { createContext, useState, useEffect, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "@/src/api/client";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const savedToken = await AsyncStorage.getItem("token");
      if (savedToken) {
        setToken(savedToken);
        const res = await apiClient.get("/auth/me");
        setUser(res.data);
      }
    } catch (err) {
      console.log("Token invalide");
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await apiClient.post("/auth/login", { email, password });
    await AsyncStorage.setItem("token", res.data.session_token);
    setToken(res.data.session_token);
    setUser(res.data.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await apiClient.post("/auth/register", { email, password, name });
    await AsyncStorage.setItem("token", res.data.session_token);
    setToken(res.data.session_token);
    setUser(res.data.user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
};
