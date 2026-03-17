import type { NextConfig } from "next";

const internalApiBase = (process.env.INTERNAL_API_URL || "http://localhost:4004/api").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
