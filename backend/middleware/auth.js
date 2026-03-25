const prisma = require("../services/prismaClient");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET. Set JWT_SECRET in backend/.env");
}

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid authorization header" });
    }

    const token = header.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token not provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === "JsonWebTokenError" || jwtError.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      throw jwtError;
    }

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: "Invalid token payload" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { shops: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.userId = user.id;
    req.user = user;
    // Attach first shop if exists (for backwards compat)
    req.shopId = user.shops?.[0]?.id || null;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    next(error);
  }
}

module.exports = authMiddleware;
