const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();
const prisma = require("../services/prismaClient");
const authMiddleware = require("../middleware/auth");
const emailService = require("../services/emailService");
const tokenService = require("../services/tokenService");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Security: Validate JWT_SECRET is properly configured
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET. Set JWT_SECRET in backend/.env");
}

if (JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET is too weak. Must be at least 32 characters. " +
    "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}

const WEAK_SECRETS = [
  "your-jwt-secret-change-in-production",
  "secret",
  "jwt-secret",
  "changeme",
];
if (WEAK_SECRETS.some((weak) => JWT_SECRET.toLowerCase().includes(weak))) {
  throw new Error("JWT_SECRET contains a default/weak value. Please generate a secure random secret.");
}

// Sign up
router.post("/signup", async (req, res, next) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    // Send welcome email first, then verification email (non-blocking)
    (async () => {
      try {
        await emailService.sendWelcomeEmail(user);
      } catch (err) {
        console.error("Failed to send welcome email:", err.message);
      }
      
      // Small delay before sending verification email
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        await emailService.sendVerificationEmail(user);
      } catch (err) {
        console.error("Failed to send verification email:", err.message);
      }
    })();

    // Don't return a token - user must verify email first
    res.status(201).json({
      success: true,
      message: "Account created! Please check your email to verify your account.",
      requiresVerification: true,
      email: user.email
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Block unverified users
    if (!user.emailVerified) {
      return res.status(403).json({ 
        error: "Please verify your email before signing in",
        code: "EMAIL_NOT_VERIFIED",
        email: user.email
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, emailVerified: user.emailVerified },
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      shops: user.shops.map((s) => ({
        id: s.id,
        domain: s.domain,
        name: s.name,
      })),
    },
  });
});

// ─── Password Reset Flow ────────────────────────────────────────

// Forgot password - request reset email
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal that the email doesn't exist
      return res.json(successResponse);
    }

    // Send password reset email
    const context = {
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "unknown",
      userAgent: req.get("User-Agent"),
    };

    emailService.sendPasswordResetEmail(user, context).catch((err) => {
      console.error("Failed to send password reset email:", err.message);
    });

    res.json(successResponse);
  } catch (error) {
    next(error);
  }
});

// Resend verification email
router.post("/resend-verification", async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Don't reveal if user exists or not for security
    if (!user) {
      return res.json({ success: true, message: "If this email exists, a verification link has been sent." });
    }

    // If already verified, still return success
    if (user.emailVerified) {
      return res.json({ success: true, message: "Email is already verified. You can sign in." });
    }

    // Send verification email
    await emailService.sendVerificationEmail(user);

    res.json({ success: true, message: "Verification email sent! Please check your inbox." });
  } catch (error) {
    next(error);
  }
});

// Reset password - set new password with token
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Verify token
    const result = tokenService.verifyPasswordResetToken(token);
    if (!result.valid) {
      return res.status(400).json({ error: result.error || "Invalid or expired reset link" });
    }

    // Check if token has been used
    const isUsed = await emailService.isTokenUsed(token);
    if (isUsed) {
      return res.status(400).json({ error: "This reset link has already been used" });
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { id: result.userId } });
    if (!user) {
      return res.status(400).json({ error: "Invalid reset link" });
    }

    // Verify email matches
    if (user.email !== result.email) {
      return res.status(400).json({ error: "Invalid reset link" });
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Mark token as used
    await emailService.markTokenUsed(token, "password_reset", new Date(Date.now() + 24 * 60 * 60 * 1000));

    // Send confirmation email
    const context = {
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "unknown",
    };
    emailService.sendPasswordChangedEmail(user, context).catch((err) => {
      console.error("Failed to send password changed email:", err.message);
    });

    res.json({ success: true, message: "Password has been reset successfully" });
  } catch (error) {
    next(error);
  }
});

// ─── Email Verification Flow ────────────────────────────────────

// Verify email with token
router.post("/verify-email", async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // Verify token
    const result = tokenService.verifyEmailVerifyToken(token);
    if (!result.valid) {
      return res.status(400).json({ error: result.error || "Invalid or expired verification link" });
    }

    // Find user first to check if already verified
    const user = await prisma.user.findUnique({ where: { id: result.userId } });
    if (!user) {
      return res.status(400).json({ error: "Invalid verification link" });
    }

    // If already verified, return success (don't error about token being used)
    if (user.emailVerified) {
      return res.json({ success: true, message: "Email already verified! You can now sign in.", alreadyVerified: true });
    }

    // Check if token has been used (only if not already verified)
    const isUsed = await emailService.isTokenUsed(token);
    if (isUsed) {
      // Double-check if the user is verified (race condition)
      const updatedUser = await prisma.user.findUnique({ where: { id: result.userId } });
      if (updatedUser?.emailVerified) {
        return res.json({ success: true, message: "Email already verified! You can now sign in.", alreadyVerified: true });
      }
      return res.status(400).json({ error: "This verification link has already been used" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Mark token as used
    await emailService.markTokenUsed(token, "email_verify", new Date(Date.now() + 24 * 60 * 60 * 1000));

    res.json({ success: true, message: "Email verified successfully! You can now sign in." });
  } catch (error) {
    next(error);
  }
});

// Change password (authenticated)
router.post("/change-password", authMiddleware, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Send confirmation email
    const context = {
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "unknown",
    };
    emailService.sendPasswordChangedEmail(user, context).catch((err) => {
      console.error("Failed to send password changed email:", err.message);
    });

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
