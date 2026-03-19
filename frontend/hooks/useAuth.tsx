"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { resolveApiBase } from "@/services/apiBase";
import {
  clearAuthState,
  getBearerAuthHeader,
  getCachedUser,
  getStoredToken,
  isTokenUsable,
  setCachedUser,
  setStoredToken,
} from "@/services/authStorage";

interface User {
  id: string;
  email: string;
  name: string | null;
  shops: { id: string; domain: string; name: string | null }[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = resolveApiBase();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const stored = getStoredToken();
    const cachedUser = getCachedUser<User>();

    if (!stored || !isTokenUsable(stored)) {
      clearAuthState();
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false && cachedUser) {
      setUser(cachedUser);
      setToken(stored);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "GET",
        credentials: "same-origin",
        headers: { ...getBearerAuthHeader(stored) },
      });
      if (res.status === 401) {
        clearAuthState();
        setUser(null);
        setToken(null);
        throw new Error("Session expired. Please sign in again.");
      }
      if (!res.ok) throw new Error("Unable to validate your session.");
      const data = await res.json();
      setUser(data.user);
      setToken(stored);
      setCachedUser(data.user);
    } catch (error) {
      if (cachedUser && isTokenUsable(stored) && typeof navigator !== "undefined" && navigator.onLine === false) {
        setUser(cachedUser);
        setToken(stored);
      } else {
        if (error instanceof Error) {
          console.warn("Auth refresh failed", error);
        }
        clearAuthState();
        setUser(null);
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({ error: "Login failed" }));
    if (!res.ok) throw new Error(data.error || "Login failed");
    if (!data.token || !isTokenUsable(data.token)) {
      throw new Error("Received invalid login session.");
    }
    setStoredToken(data.token);
    setCachedUser(data.user);
    setToken(data.token);
    setUser(data.user);
  };

  const signup = async (email: string, password: string, name: string) => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json().catch(() => ({ error: "Signup failed" }));
    if (!res.ok) throw new Error(data.error || "Signup failed");
    if (!data.token || !isTokenUsable(data.token)) {
      throw new Error("Received invalid signup session.");
    }
    setStoredToken(data.token);
    setCachedUser(data.user);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    clearAuthState();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
