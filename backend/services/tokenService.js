/**
 * Token Service
 * Generates and validates secure tokens for email verification, password reset, and unsubscribe.
 */

const crypto = require("crypto");
const emailConfig = require("../config/emailConfig");

const TOKEN_TYPES = {
  PASSWORD_RESET: "password_reset",
  EMAIL_VERIFY: "email_verify",
  UNSUBSCRIBE: "unsubscribe",
};

/**
 * Generate a secure random token
 * @returns {string} Hex-encoded random token
 */
function generateRandomToken() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a signed token with payload and expiry
 * @param {string} type - Token type (password_reset, email_verify, unsubscribe)
 * @param {object} payload - Data to encode in token
 * @param {number} [expiryHours] - Hours until expiry (default based on type)
 * @returns {string} Base64-encoded signed token
 */
function createToken(type, payload, expiryHours) {
  const secret = emailConfig.tokens.secret;
  if (!secret) {
    throw new Error("EMAIL_TOKEN_SECRET is not configured");
  }

  // Determine expiry based on token type
  let defaultExpiry;
  switch (type) {
    case TOKEN_TYPES.PASSWORD_RESET:
      defaultExpiry = emailConfig.tokens.passwordResetExpiryHours;
      break;
    case TOKEN_TYPES.EMAIL_VERIFY:
      defaultExpiry = emailConfig.tokens.emailVerifyExpiryHours;
      break;
    case TOKEN_TYPES.UNSUBSCRIBE:
      defaultExpiry = emailConfig.tokens.unsubscribeExpiryDays * 24;
      break;
    default:
      defaultExpiry = 24;
  }

  const expiry = expiryHours || defaultExpiry;
  const expiresAt = Date.now() + expiry * 60 * 60 * 1000;

  const tokenData = {
    type,
    payload,
    exp: expiresAt,
    iat: Date.now(),
    jti: generateRandomToken().substring(0, 16), // Unique token ID
  };

  const dataString = JSON.stringify(tokenData);
  const dataBase64 = Buffer.from(dataString).toString("base64url");

  // Create HMAC signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(dataBase64);
  const signature = hmac.digest("base64url");

  return `${dataBase64}.${signature}`;
}

/**
 * Verify and decode a signed token
 * @param {string} token - The token to verify
 * @param {string} [expectedType] - Expected token type (optional)
 * @returns {{ valid: boolean, payload?: object, error?: string }}
 */
function verifyToken(token, expectedType) {
  const secret = emailConfig.tokens.secret;
  if (!secret) {
    return { valid: false, error: "Token service not configured" };
  }

  if (!token || typeof token !== "string") {
    return { valid: false, error: "Invalid token format" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Invalid token structure" };
  }

  const [dataBase64, providedSignature] = parts;

  // Verify signature
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(dataBase64);
  const expectedSignature = hmac.digest("base64url");

  if (!crypto.timingSafeEqual(
    Buffer.from(providedSignature),
    Buffer.from(expectedSignature)
  )) {
    return { valid: false, error: "Invalid token signature" };
  }

  // Decode data
  let tokenData;
  try {
    const dataString = Buffer.from(dataBase64, "base64url").toString("utf8");
    tokenData = JSON.parse(dataString);
  } catch {
    return { valid: false, error: "Invalid token data" };
  }

  // Check expiry
  if (tokenData.exp && Date.now() > tokenData.exp) {
    return { valid: false, error: "Token has expired" };
  }

  // Check type if specified
  if (expectedType && tokenData.type !== expectedType) {
    return { valid: false, error: "Invalid token type" };
  }

  return {
    valid: true,
    type: tokenData.type,
    payload: tokenData.payload,
    issuedAt: tokenData.iat,
    expiresAt: tokenData.exp,
    tokenId: tokenData.jti,
  };
}

/**
 * Create a password reset token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} Signed token
 */
function createPasswordResetToken(userId, email) {
  return createToken(TOKEN_TYPES.PASSWORD_RESET, { userId, email });
}

/**
 * Create an email verification token
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {string} Signed token
 */
function createEmailVerifyToken(userId, email) {
  return createToken(TOKEN_TYPES.EMAIL_VERIFY, { userId, email });
}

/**
 * Create an unsubscribe token
 * @param {string} shopId - Shop ID
 * @param {string} email - Email to unsubscribe
 * @param {string} [emailType] - Type of emails to unsubscribe from
 * @returns {string} Signed token
 */
function createUnsubscribeToken(shopId, email, emailType = "all") {
  return createToken(TOKEN_TYPES.UNSUBSCRIBE, { shopId, email, emailType });
}

/**
 * Verify a password reset token
 * @param {string} token - Token to verify
 * @returns {{ valid: boolean, userId?: string, email?: string, error?: string }}
 */
function verifyPasswordResetToken(token) {
  const result = verifyToken(token, TOKEN_TYPES.PASSWORD_RESET);
  if (!result.valid) return result;
  return {
    valid: true,
    userId: result.payload.userId,
    email: result.payload.email,
    tokenId: result.tokenId,
  };
}

/**
 * Verify an email verification token
 * @param {string} token - Token to verify
 * @returns {{ valid: boolean, userId?: string, email?: string, error?: string }}
 */
function verifyEmailVerifyToken(token) {
  const result = verifyToken(token, TOKEN_TYPES.EMAIL_VERIFY);
  if (!result.valid) return result;
  return {
    valid: true,
    userId: result.payload.userId,
    email: result.payload.email,
    tokenId: result.tokenId,
  };
}

/**
 * Verify an unsubscribe token
 * @param {string} token - Token to verify
 * @returns {{ valid: boolean, shopId?: string, email?: string, emailType?: string, error?: string }}
 */
function verifyUnsubscribeToken(token) {
  const result = verifyToken(token, TOKEN_TYPES.UNSUBSCRIBE);
  if (!result.valid) return result;
  return {
    valid: true,
    shopId: result.payload.shopId,
    email: result.payload.email,
    emailType: result.payload.emailType,
    tokenId: result.tokenId,
  };
}

/**
 * Hash a token for storage (used to prevent token reuse)
 * @param {string} token - Token to hash
 * @returns {string} SHA-256 hash of token
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  TOKEN_TYPES,
  generateRandomToken,
  createToken,
  verifyToken,
  createPasswordResetToken,
  createEmailVerifyToken,
  createUnsubscribeToken,
  verifyPasswordResetToken,
  verifyEmailVerifyToken,
  verifyUnsubscribeToken,
  hashToken,
};
