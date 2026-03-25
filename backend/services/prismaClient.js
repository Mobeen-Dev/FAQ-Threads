const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings to handle idle timeouts
  max: 10,                    // Max connections in pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Fail fast if can't connect in 10s
  allowExitOnIdle: true,      // Allow pool to close when idle
});

// Handle pool errors (prevents crash on connection loss)
pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
