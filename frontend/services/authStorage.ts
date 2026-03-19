const TOKEN_KEY = "token";
const USER_CACHE_KEY = "auth_user_cache:v1";
const API_CACHE_PREFIX = "faq-api-cache:v1:";

function isBrowser() {
  return typeof window !== "undefined";
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

export function getStoredToken() {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  if (!isBrowser()) return;
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing && existing !== token) {
    clearApiCache();
  }
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getCachedUser<T>() {
  if (!isBrowser()) return null as T | null;
  const cachedUserRaw = localStorage.getItem(USER_CACHE_KEY);
  if (!cachedUserRaw) return null as T | null;
  try {
    return JSON.parse(cachedUserRaw) as T;
  } catch (error) {
    console.warn("Failed to parse cached auth user", error);
    localStorage.removeItem(USER_CACHE_KEY);
    return null as T | null;
  }
}

export function setCachedUser<T>(user: T) {
  if (!isBrowser()) return;
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export function clearCachedUser() {
  if (!isBrowser()) return;
  localStorage.removeItem(USER_CACHE_KEY);
}

export function clearApiCache() {
  if (!isBrowser()) return;
  const keysToRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith(API_CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}

export function clearAuthState() {
  clearStoredToken();
  clearCachedUser();
  clearApiCache();
}

export function getJwtExpiryMs(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: unknown };
    if (typeof parsed.exp !== "number") return null;
    return parsed.exp * 1000;
  } catch (error) {
    console.warn("Failed to decode JWT payload", error);
    return null;
  }
}

export function isTokenUsable(token: string, skewSeconds = 30) {
  if (!token.trim()) return false;
  const expiryMs = getJwtExpiryMs(token);
  if (!expiryMs) return true;
  return Date.now() + skewSeconds * 1000 < expiryMs;
}

export function getBearerAuthHeader(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function normalizeEmail(email: string) {
  return email.trim();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStrongPassword(password: string) {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}
