import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  agentRules: false,
  output: "export",
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
}

export default nextConfig
