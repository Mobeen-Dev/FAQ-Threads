const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4004/api";
const CACHE_PREFIX = "faq-api-cache:v1:";
const CACHE_TTL_MS = 30 * 60 * 1000;

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getCacheKey(endpoint: string, token: string | null) {
  const tokenScope = token ? token.slice(-12) : "anon";
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = (options.method || "GET").toUpperCase();
  const cacheKey = method === "GET" ? getCacheKey(endpoint, token) : null;
  const cached = cacheKey ? readCached<T>(cacheKey) : null;

  if (cached && typeof navigator !== "undefined" && navigator.onLine === false) {
    return cached;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    if (cached) return cached;
    throw err;
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
  categoryId: string | null;
  category?: Category;
  contributor?: { id: string; name: string | null; email: string; trusted: boolean } | null;
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
  question?: { id: string; question: string; status: string } | null;
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
  webhookUrl: string;
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
  getAnalytics() {
    return request<AnalyticsData>("/questions/analytics");
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
};
