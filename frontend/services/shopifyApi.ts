import { resolveApiBase } from "@/services/apiBase";
import {
  clearAuthState,
  getBearerAuthHeader,
  getStoredToken,
  isTokenUsable,
} from "@/services/authStorage";

const API_BASE = resolveApiBase();
const CACHE_PREFIX = "faq-api-cache:v1:";
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCacheKey(endpoint: string, token: string | null) {
  const tokenScope = token ? "auth" : "anon";
  return `${CACHE_PREFIX}${tokenScope}:${endpoint}`;
}

function readCached<T>(cacheKey: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; data: T };
    if (!parsed || typeof parsed.timestamp !== "number") return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCached<T>(cacheKey: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {
    // Ignore storage write errors.
  }
}

// Export for direct backend API calls (used by auth pages)
export async function backendFetch<T = Record<string, unknown>>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const storedToken = getStoredToken();
  const token = storedToken && isTokenUsable(storedToken) ? storedToken : null;
  if (storedToken && !token) {
    clearAuthState();
  }
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = method === "GET" ? getCacheKey(endpoint, token) : null;
  const cached = cacheKey ? readCached<T>(cacheKey) : null;

  if (cached && typeof navigator !== "undefined" && navigator.onLine === false) {
    return cached;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getBearerAuthHeader(token),
    ...(options.headers as Record<string, string>),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: "same-origin",
      headers,
    });
  } catch (err) {
    if (cached) return cached;
    throw err;
  }

  if (response.status === 401) {
    clearAuthState();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    if (cached && response.status >= 500) {
      return cached;
    }
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  const data = await response.json();
  if (cacheKey) writeCached(cacheKey, data);
  return data;
}

// ---------- Types ----------

export interface Question {
  id: string;
  question: string;
  answer: string;
  status: string;
  sortOrder: number;
  views: number;
  helpful: number;
  notHelpful: number;
  voteScore: number;
  productId?: string | null;
  productHandle?: string | null;
  productTitle?: string | null;
  product?: {
    id: string;
    title: string;
    firstImageUrl?: string | null;
    frontendUrl: string;
    handle?: string | null;
  } | null;
  categoryId: string | null;
  category?: Category;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  contributor?: { id: string; name: string | null; email: string; phone?: string | null; trusted: boolean } | null;
  _count?: { answers: number; votes: number };
  answers?: Answer[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Answer {
  id: string;
  answerText: string;
  status: string;
  voteScore: number;
  source: string;
  contributor?: { id: string; name: string | null; email: string; trusted: boolean } | null;
  question?: {
    id: string;
    question: string;
    status: string;
    productTitle?: string | null;
    productHandle?: string | null;
    product?: {
      title?: string | null;
      firstImageUrl?: string | null;
      frontendUrl?: string | null;
      handle?: string | null;
    } | null;
  } | null;
  _count?: { votes: number };
  publishedAt: string | null;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  sortOrder: number;
  _count?: { questions: number };
}

export interface StoreContributor {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  externalId: string | null;
  status: string;
  trusted: boolean;
  _count?: { questions: number; answers: number; votes: number };
  createdAt: string;
}

export interface Settings {
  id?: string;
  widgetEnabled: boolean;
  widgetPosition: string;
  primaryColor: string;
  allowSubmission: boolean;
  notifyEmail: string | null;
  autoPublishQuestions: boolean;
  manualPublishQuestions: boolean;
  publishQuestionsAfterTimeEnabled: boolean;
  publishQuestionsAfterMinutes: number;
  publishQuestionsAfterHours: number;
  autoPublishAnswers: boolean;
  manualPublishAnswers: boolean;
  publishAnswersAfterTimeEnabled: boolean;
  publishAnswersAfterMinutes: number;
  publishAnswersAfterHours: number;
  autoPublishIfAnswersLessThan: number;
  autoModeration: boolean;
  trustedCustomerAutoPublish: boolean;
}

export interface PaginatedResponse<T> {
  questions: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
}

export interface AnalyticsData {
  totalQuestions: number;
  published: number;
  pending: number;
  suspended: number;
  categories: number;
  totalAnswers: number;
  publishedAnswers: number;
  totalContributors: number;
  trustedContributors: number;
}

export interface ShopCredentials {
  shop: {
    id: string;
    domain: string;
    apiKey: string | null;
    accessToken: string | null;
    name: string | null;
  } | null;
  widgetHtml: string;
}

export interface McpTokenStatus {
  tokenConfigured: boolean;
  tokenCreatedAt: string | null;
  clientKeyConfigured: boolean;
  clientKeyCreatedAt: string | null;
}

export interface McpRotateResponse {
  token: string;
  clientKey: string;
  createdAt: string;
  mcpApiBaseUrl: string;
  warning?: string;
}

export interface EmailStatus {
  service: {
    provider: string;
    ready: boolean;
    previewMode: boolean;
  };
  queue: {
    pending: number;
    failed: number;
    processing: boolean;
  };
  scheduler: {
    running: boolean;
    nextRun: string | null;
  };
}

export interface EmailLog {
  id: string;
  emailType: string;
  recipient: string;
  subject: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  errorMessage: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export const shopifyApi = {
  // Questions
  getQuestions(params?: Record<string, string>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<PaginatedResponse<Question>>(`/questions${query}`);
  },

  getQuestion(id: string) {
    return request<{ question: Question }>(`/questions/${id}`);
  },

  createQuestion(data: Partial<Question>) {
    return request<{ question: Question }>("/questions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateQuestion(id: string, data: Partial<Question>) {
    return request<{ question: Question }>(`/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteQuestion(id: string) {
    return request<void>(`/questions/${id}`, { method: "DELETE" });
  },

  moderateQuestion(id: string, action: string) {
    return request<{ question: Question }>(`/questions/${id}/moderate`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },

  // Categories
  getCategories() {
    return request<{ categories: Category[] }>("/questions/categories");
  },

  createCategory(data: { name: string; description?: string }) {
    return request<{ category: Category }>("/questions/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Answers
  getAnswers(questionId?: string, params?: Record<string, string>) {
    const queryParams = new URLSearchParams({
      ...(questionId ? { questionId } : {}),
      ...(params || {}),
    }).toString();
    const query = queryParams ? `?${queryParams}` : "";
    return request<{ answers: Answer[] }>(`/answers${query}`);
  },

  createAnswer(data: { questionId: string; answerText: string; status?: string }) {
    return request<{ answer: Answer }>("/answers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateAnswer(id: string, data: Partial<Answer>) {
    return request<{ answer: Answer }>(`/answers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteAnswer(id: string) {
    return request<void>(`/answers/${id}`, { method: "DELETE" });
  },

  moderateAnswer(id: string, action: string) {
    return request<{ answer: Answer }>(`/answers/${id}/moderate`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  },

  // Settings
  getSettings() {
    return request<{ settings: Settings }>("/settings");
  },

  updateSettings(data: Partial<Settings>) {
    return request<{ settings: Settings }>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Analytics
  getAnalytics(params?: Record<string, string>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<AnalyticsData>(`/questions/analytics${query}`);
  },

  // Contributors
  getContributors(params?: Record<string, string>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{ contributors: StoreContributor[] }>(`/contributors${query}`);
  },

  updateContributor(id: string, data: Partial<StoreContributor>) {
    return request<{ contributor: StoreContributor }>(`/contributors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  suspendContributor(id: string) {
    return request<{ contributor: StoreContributor }>(`/contributors/${id}/suspend`, { method: "POST" });
  },

  unsuspendContributor(id: string) {
    return request<{ contributor: StoreContributor }>(`/contributors/${id}/unsuspend`, { method: "POST" });
  },

  trustContributor(id: string, trusted: boolean) {
    return request<{ contributor: StoreContributor }>(`/contributors/${id}/trust`, {
      method: "POST",
      body: JSON.stringify({ trusted }),
    });
  },

  // Credentials
  getCredentials() {
    return request<ShopCredentials>("/credentials");
  },

  saveCredentials(data: { domain: string; apiKey?: string; accessToken?: string; name?: string }) {
    return request<ShopCredentials>("/credentials", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  deleteCredentials() {
    return request<void>("/credentials", { method: "DELETE" });
  },

  // MCP
  getMcpTokenStatus() {
    return request<McpTokenStatus>(`/mcp/token/status?nonce=${Date.now()}`);
  },

  rotateMcpToken() {
    return request<McpRotateResponse>("/mcp/token/rotate", {
      method: "POST",
    });
  },

  // Email & Account
  getEmailStatus() {
    return request<EmailStatus>("/email/status");
  },

  getEmailLogs(params?: Record<string, string>) {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<{
      logs: EmailLog[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/email/logs${query}`);
  },

  sendTestEmail(templateName: string) {
    return request<{ success: boolean; message: string; skipped?: boolean; reason?: string }>("/email/test", {
      method: "POST",
      body: JSON.stringify({ templateName }),
    });
  },

  resendVerificationEmail() {
    return request<{ success: boolean; message: string }>("/email/resend-verification", {
      method: "POST",
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return request<{ success: boolean; message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};
