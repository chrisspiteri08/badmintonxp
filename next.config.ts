import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.badmintonxp.com" }],
        destination: "https://badmintonxp.com/:path*",
        permanent: false,
      },
      { source: "/", destination: "/play", permanent: false },
      { source: "/login", destination: "/play/account", permanent: false },
      { source: "/signup", destination: "/play/account", permanent: false },
      {
        source: "/leaderboards",
        destination: "/play/standings",
        permanent: false,
      },
    ];
  },
  // Keep dev browser checks separate from production build artifacts.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "wochzxpmsjscfjkenhpu.supabase.co",
      },
    ],
  },
  allowedDevOrigins: [
    "6000-firebase-studio-1748374989254.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev",
  ],
};

export default nextConfig;
