import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force clean builds when env changes — Turbopack cache key
  generateBuildId: () => `build-${Date.now()}`,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
