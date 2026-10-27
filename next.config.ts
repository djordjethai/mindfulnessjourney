import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
