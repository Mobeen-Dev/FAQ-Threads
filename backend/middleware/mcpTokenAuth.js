const mcpTokenService = require("../services/mcpTokenService");

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  const mcpHeader = req.headers["x-mcp-token"];
  if (typeof mcpHeader === "string" && mcpHeader.trim()) {
    return mcpHeader.trim();
  }

  return null;
}

async function mcpTokenAuth(req, res, next) {
  try {
    const clientKey = req.params.clientKey;
    if (!clientKey || typeof clientKey !== "string") {
      return res.status(401).json({ error: "Missing MCP client key in URL path." });
    }

    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Missing MCP token. Use Bearer token or x-mcp-token header." });
    }

    const [tokenContext, keyContext] = await Promise.all([
      mcpTokenService.resolveToken(token),
      mcpTokenService.resolveClientKey(clientKey),
    ]);

    if (!keyContext) {
      return res.status(401).json({ error: "Invalid MCP client key. Rotate a new token/key from /api/mcp/token/rotate." });
    }

    if (!tokenContext) {
      return res.status(401).json({ error: "Invalid MCP token. Rotate a new token from /api/mcp/token/rotate." });
    }

    if (tokenContext.shopId !== keyContext.shopId) {
      return res.status(401).json({ error: "MCP token/client key mismatch. Rotate fresh credentials from /api/mcp/token/rotate." });
    }

    req.shopId = tokenContext.shopId;
    req.mcp = {
      ...tokenContext,
      clientKeyCreatedAt: keyContext.createdAt,
    };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = mcpTokenAuth;
