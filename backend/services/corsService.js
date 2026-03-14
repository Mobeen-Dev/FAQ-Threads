function parseOriginValues(rawValues) {
  return rawValues
    .flatMap((value) => (value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function toOrigin(value) {
  try {
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(normalized).origin.toLowerCase();
  } catch {
    return null;
  }
}

function toHost(value) {
  const origin = toOrigin(value);
  if (!origin) return null;
  return new URL(origin).hostname.toLowerCase();
}

function getConfiguredOrigins() {
  const configured = parseOriginValues([process.env.FRONTEND_URL || "http://localhost:3000", process.env.ALLOWED_ORIGINS]);
  return new Set(configured.map(toOrigin).filter(Boolean));
}

function getConfiguredHosts() {
  const configuredOrigins = [...getConfiguredOrigins()];
  return new Set(configuredOrigins.map(toHost).filter(Boolean));
}

function isStaticOriginAllowed(origin) {
  const originValue = toOrigin(origin);
  if (!originValue) return false;

  const configuredOrigins = getConfiguredOrigins();
  if (configuredOrigins.has(originValue)) return true;

  const originHost = toHost(originValue);
  const configuredHosts = getConfiguredHosts();
  return !!originHost && configuredHosts.has(originHost);
}

function extractWebhookUserId(pathname) {
  const match = pathname.match(/^\/api\/webhooks\/([^/]+)/);
  return match ? match[1] : null;
}

async function resolveCorsOptions(req) {
  const origin = req.headers.origin;

  // Allow non-browser requests (no Origin header), such as server-to-server webhooks and tests.
  if (!origin) return { origin: true };

  // Webhook endpoints are public by design for storefront usage, so allow any browser origin.
  if (extractWebhookUserId(req.path)) return { origin: true };

  if (isStaticOriginAllowed(origin)) return { origin: true };

  return { origin: false };
}

module.exports = { resolveCorsOptions };
