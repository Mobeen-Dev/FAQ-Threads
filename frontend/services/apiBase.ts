const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

function normalizeBase(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function ensureApiPath(baseUrl: string) {
  const normalized = normalizeBase(baseUrl);
  if (!normalized) return normalized;
  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (!pathname || pathname === "") {
      parsed.pathname = "/api";
      return normalizeBase(parsed.toString());
    }
    if (pathname === "/") {
      parsed.pathname = "/api";
      return normalizeBase(parsed.toString());
    }
    return normalized;
  } catch {
    return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
  }
}

export function resolveApiBase() {
  const configured = ensureApiPath(process.env.NEXT_PUBLIC_API_URL || "");

  if (typeof window === "undefined") {
    return configured || "http://localhost:4004/api";
  }

  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol;
  const inferred = `${currentProtocol}//${currentHost}:4004/api`;

  if (!configured) return inferred;

  try {
    const parsed = new URL(configured);
    if (isLocalHost(parsed.hostname) && !isLocalHost(currentHost)) {
      return inferred;
    }
    return ensureApiPath(configured);
  } catch {
    return ensureApiPath(configured);
  }
}
