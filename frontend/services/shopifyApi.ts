const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

// ---------- Questions ----------

export interface Question {
  id: string;
  question: string;
  answer: string;
  status: string;
  sortOrder: number;
  views: number;
  helpful: number;
  notHelpful: number;
  categoryId: string | null;
  category?: Category;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  sortOrder: number;
  _count?: { questions: number };
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
  categories: number;
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

  moderateQuestion(id: string, action: "approve" | "reject") {
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

  // Analytics
  getAnalytics() {
    return request<AnalyticsData>("/questions/analytics");
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
