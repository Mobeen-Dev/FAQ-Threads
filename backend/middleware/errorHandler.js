const isProduction = process.env.NODE_ENV === "production";

function errorHandler(err, _req, res, _next) {
  // Log errors appropriately based on environment
  if (isProduction) {
    // Production: Log only essential info (no stack traces, no sensitive data)
    console.error("Error:", {
      code: err.code,
      name: err.name,
      status: err.status || 500,
    });
  } else {
    // Development: Full error for debugging
    console.error("Unhandled error:", err);
  }

  // Prisma-specific errors
  if (err.code === "P2002") {
    return res.status(409).json({ error: "A record with that value already exists" });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }

  // Generic error response - hide internal details in production
  const message = isProduction ? "Internal server error" : (err.message || "Internal server error");

  res.status(err.status || 500).json({ error: message });
}

module.exports = errorHandler;
