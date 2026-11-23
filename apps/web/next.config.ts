import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: process.env.CONTAINER_BUILD ? { cpus: 2 } : undefined,
  async rewrites() {
    const api = process.env.INTERNAL_API_URL;
    return api ? [{ source: "/api/:path*", destination: `${api}/api/:path*` }] : [];
  },
};

export default nextConfig;

